# OpenAI Session OAuth Converter

Manual Node.js tool for:

- pasting one or more session JSON objects
- generating an OpenAI OAuth login URL with `offline_access`
- manually pasting the returned callback URL or `code`
- exchanging that `code` for `access_token`, `refresh_token`, and `id_token`
- optionally exporting Session records directly without `refresh_token`
- exporting JSON in Cockpit / CPA / Sub2API / 9router shapes

## Project Structure

```text
openai-session-converter/
├─ app.js
├─ server.js
├─ package.json
├─ .env.example
├─ public/
│  ├─ index.html
│  └─ styles.css
└─ README.md
```

## Install

```bash
npm install
cp .env.example .env
```

Update `.env` with your own OAuth app values:

- `OPENAI_CLIENT_ID`
- `OPENAI_REDIRECT_URI`
- optionally `OPENAI_CLIENT_SECRET`

## Run

```bash
npm start
```

Open `http://localhost:3000`.

## Important Notes

- This project uses a fully manual flow. It does not automate login.
- The PKCE `code_verifier` is created in the browser and sent to `/exchange`.
- The server does not store tokens in a database.
- The returned output is normalized to a Cockpit-style record.
- `refresh_token` is optional. If you skip OAuth exchange, you can still export a Session-based record with an empty `refresh_token`.

```json
{
  "type": "codex",
  "id_token": "xxx",
  "access_token": "xxx",
  "refresh_token": "xxx",
  "account_id": "xxx",
  "last_refresh": "2026-05-12T10:00:00.000Z",
  "email": "user@example.com",
  "expired": "2026-05-12T11:00:00.000Z"
}
```

## Example Session Input

```json
[
  {
    "email": "alpha@example.com",
    "access_token": "session-access-token-alpha",
    "account_id": "acct_alpha"
  },
  {
    "email": "beta@example.com",
    "access_token": "session-access-token-beta",
    "account_id": "acct_beta"
  }
]
```

## Example Output

```json
[
  {
    "type": "codex",
    "id_token": "eyJhbGciOi...",
    "access_token": "access-token-value",
    "refresh_token": "refresh-token-value",
    "account_id": "user_123456",
    "last_refresh": "2026-05-12T10:00:00.000Z",
    "email": "alpha@example.com",
    "expired": "2026-05-12T11:00:00.000Z"
  }
]
```

## OAuth Endpoints Used

- Authorization URL default: `https://auth.openai.com/oauth/authorize`
- Token URL default: `https://auth.openai.com/oauth/token`

If your OpenAI app uses different values, override them in `.env`.
