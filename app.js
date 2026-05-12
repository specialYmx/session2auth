const express = require("express");
const path = require("path");

const DEFAULT_AUTH_URL = "https://auth.openai.com/oauth/authorize";
const DEFAULT_TOKEN_URL = "https://auth.openai.com/oauth/token";
const DEFAULT_SCOPE = "openid profile email offline_access";
const DEFAULT_CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";
const DEFAULT_REDIRECT_URI = "http://localhost:1455/auth/callback";

function normalizeBasePath(value) {
  if (!value || value === "/") {
    return "";
  }

  const withLeadingSlash = value.startsWith("/") ? value : `/${value}`;
  return withLeadingSlash.replace(/\/+$/, "");
}

function parseJwtPayload(jwt) {
  if (!jwt || typeof jwt !== "string" || jwt.split(".").length < 2) {
    return {};
  }

  try {
    // JWT payload is base64url encoded in the second segment.
    const base64 = jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const json = Buffer.from(padded, "base64").toString("utf8");
    return JSON.parse(json);
  } catch (error) {
    return {};
  }
}

function toIsoFromSeconds(seconds) {
  if (!seconds || Number.isNaN(Number(seconds))) {
    return new Date().toISOString();
  }

  return new Date(Number(seconds) * 1000).toISOString();
}

function normalizeTokenResponse(tokenResponse) {
  const nowIso = new Date().toISOString();
  const idPayload = parseJwtPayload(tokenResponse.id_token);
  const accessPayload = parseJwtPayload(tokenResponse.access_token);

  // Prefer claims from id_token, then fall back to access_token or provider fields.
  const accountId =
    idPayload.sub ||
    accessPayload.sub ||
    tokenResponse.account_id ||
    tokenResponse.user_id ||
    "";

  const email =
    idPayload.email ||
    accessPayload.email ||
    tokenResponse.email ||
    "";

  const exp =
    idPayload.exp ||
    accessPayload.exp ||
    (
      tokenResponse.expires_in
        ? Math.floor(Date.now() / 1000) + Number(tokenResponse.expires_in)
        : null
    );

  return {
    type: "codex",
    id_token: tokenResponse.id_token || "",
    access_token: tokenResponse.access_token || "",
    refresh_token: tokenResponse.refresh_token || "",
    account_id: accountId,
    last_refresh: nowIso,
    email,
    expired: toIsoFromSeconds(exp)
  };
}

function createApp() {
  const app = express();
  const basePath = normalizeBasePath(process.env.BASE_PATH || "");

  app.use(express.json({ limit: "2mb" }));
  app.use((req, res, next) => {
    res.locals.basePath = basePath;
    next();
  });

  app.get(`${basePath}/`, (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
  });

  app.use(basePath, express.static(path.join(__dirname, "public")));

  app.get(`${basePath}/config`, (req, res) => {
    res.json({
      clientId: process.env.OPENAI_CLIENT_ID || DEFAULT_CLIENT_ID,
      redirectUri: process.env.OPENAI_REDIRECT_URI || DEFAULT_REDIRECT_URI,
      scope: process.env.OPENAI_SCOPE || DEFAULT_SCOPE,
      authorizationUrl:
        process.env.OPENAI_AUTHORIZATION_URL || DEFAULT_AUTH_URL,
      tokenUrl: process.env.OPENAI_TOKEN_URL || DEFAULT_TOKEN_URL,
      basePath
    });
  });

  app.post(`${basePath}/exchange`, async (req, res) => {
    const {
      code,
      code_verifier: codeVerifier,
      redirect_uri: redirectUri
    } = req.body || {};

    const clientId = process.env.OPENAI_CLIENT_ID || DEFAULT_CLIENT_ID;
    const clientSecret = process.env.OPENAI_CLIENT_SECRET || "";
    const tokenUrl = process.env.OPENAI_TOKEN_URL || DEFAULT_TOKEN_URL;
    const configuredRedirectUri =
      process.env.OPENAI_REDIRECT_URI || DEFAULT_REDIRECT_URI;

    if (!code || !codeVerifier) {
      return res.status(400).json({
        error: "missing_parameters",
        message: "Both code and code_verifier are required."
      });
    }

    // Build a standard OAuth authorization_code + PKCE token request.
    const form = new URLSearchParams();
    form.set("grant_type", "authorization_code");
    form.set("client_id", clientId);
    form.set("code", code);
    form.set("code_verifier", codeVerifier);
    form.set("redirect_uri", redirectUri || configuredRedirectUri);

    if (clientSecret) {
      form.set("client_secret", clientSecret);
    }

    try {
      const response = await fetch(tokenUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: form.toString()
      });

      const rawText = await response.text();
      let data;

      try {
        data = JSON.parse(rawText);
      } catch (error) {
        data = { raw: rawText };
      }

      if (!response.ok) {
        return res.status(response.status).json({
          error: "token_exchange_failed",
          message: "OAuth token exchange failed.",
          provider_status: response.status,
          provider_response: data
        });
      }

      // Return both the raw provider response and the normalized Cockpit object.
      return res.json({
        raw: data,
        cockpit: normalizeTokenResponse(data)
      });
    } catch (error) {
      return res.status(502).json({
        error: "upstream_request_failed",
        message: error.message
      });
    }
  });

  return app;
}

module.exports = {
  createApp,
  normalizeTokenResponse,
  parseJwtPayload
};
