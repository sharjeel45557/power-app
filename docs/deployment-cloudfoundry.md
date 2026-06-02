# Deploying to Cloud Foundry

power-app deploys as a **single application**: the Fastify host serves both the
JSON API and the pre-built React SPA. Configuration comes entirely from the
environment and `VCAP_SERVICES`, so no secrets live in the repo or
[`manifest.yml`](../manifest.yml).

## Prerequisites

- Access to the org/space (via your head-office IT Cloud Foundry).
- The Cloud Foundry CLI (`cf`) logged in: `cf login -a <api-endpoint>`.
- A **Postgres** service plan available in the marketplace (`cf marketplace`).
- An **Entra App Registration** — see [entra-setup.md](entra-setup.md).

## 1. Create the Postgres service

```bash
# names the instance "power-app-db" to match manifest.yml
cf create-service <postgres-service> <plan> power-app-db
```

The app reads the bound connection string from `VCAP_SERVICES` automatically —
no `DATABASE_URL` needed in the manifest.

## 2. Supply secrets via a user-provided service

Keep Entra config and session keys out of the manifest by putting them in a
user-provided service named `power-app-config` (read automatically by
`loadConfig()`):

```bash
# generate a 32-byte session key
SESSION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")

cf create-user-provided-service power-app-config -p '{
  "OIDC_AUTHORITY": "https://login.microsoftonline.com/<TENANT_ID>/v2.0",
  "OIDC_CLIENT_ID": "<client-id>",
  "OIDC_CLIENT_SECRET": "<client-secret>",
  "OIDC_REDIRECT_URI": "https://<your-app-host>/auth/callback",
  "ROLE_MAPPINGS": "{\"<admins-guid>\":\"admin\",\"<editors-guid>\":\"editor\"}",
  "SESSION_KEYS": "'"$SESSION_KEY"'",
  "BASE_URL": "https://<your-app-host>"
}'
```

Then add it to the `services:` list in `manifest.yml` alongside `power-app-db`
(or bind after push with `cf bind-service`).

## 3. Build, then push

The Node.js buildpack runs `npm start` (→ the Fastify host). Build artifacts are
produced **before** the push so the running app only needs to boot:

```bash
pnpm install
pnpm build           # builds core, the SPA (apps/web/dist), and the server
cf push              # uses manifest.yml
```

On boot the app runs pending database migrations automatically, then begins
serving. Cloud Foundry's health check polls `/healthz`.

> **Note on the buildpack & pnpm.** This is a pnpm workspace. Depending on your
> foundation's buildpack, you may need to either (a) push with `node_modules`
> and the built `dist/` directories included (simplest — vendor the install in
> CI), or (b) add a `packagemanager`/buildpack hook that runs `pnpm install`.
> Confirm the approach with your platform team; CI-based build-then-push is the
> most reliable.

## 4. Configure & verify

- Ensure `AUTH_MODE=entra` (set in `manifest.yml`).
- Make sure the App Registration's redirect URI exactly matches
  `https://<your-app-host>/auth/callback`.
- After push: `cf apps`, then browse to the route and sign in with Microsoft.
- Health: `curl https://<your-app-host>/healthz` and `/readyz`.

## Scaling & operations

- **Scale out** freely: sessions are in encrypted cookies, so any instance can
  serve any request. `cf scale power-app -i 3`.
- **Logs**: `cf logs power-app --recent` (the app emits structured JSON logs).
- **Rotate secrets**: update the `power-app-config` service and restage.
  `SESSION_KEYS` accepts a comma-separated list to allow key rotation without
  invalidating all sessions at once.
- **Migrations**: applied automatically on boot; idempotent and safe to re-run.
