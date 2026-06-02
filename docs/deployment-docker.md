# Deploying as a Docker image

Apps built on this framework ship to IT as a **single Docker image**. The image
serves both the JSON API and the React SPA, and runs database migrations on
boot — so IT only needs to run the container, point it at Postgres, and supply
configuration via environment variables.

> The image has **no secrets baked in** (`.env` is excluded via `.dockerignore`).
> All configuration is provided at runtime.

## Build

```bash
docker build -t power-app:latest .
# tag for your registry, e.g.
docker tag power-app:latest registry.example.com/power-app:1.0.0
docker push registry.example.com/power-app:1.0.0
```

The build is multi-stage: a builder installs all dependencies and builds every
package; the final image keeps only production dependencies plus the built
output, and runs as the non-root `node` user.

## Run

```bash
docker run -p 8080:8080 --env-file prod.env registry.example.com/power-app:1.0.0
```

The container listens on `PORT` (default `8080`) and exposes:
`/healthz` (liveness), `/readyz` (readiness — checks the DB).

### Required environment

| Variable | Notes |
| --- | --- |
| `DATABASE_URL` | Postgres connection string. Migrations run automatically on boot. |
| `SESSION_KEYS` | One or more base64 32-byte keys (comma-separated, rotatable). **Required in production.** |
| `BASE_URL` | Public URL of the app, e.g. `https://app.example.com` (used for the OIDC redirect + CSRF allowlist). |
| `AUTH_MODE` | `entra` in production. |
| `OIDC_AUTHORITY` | `https://login.microsoftonline.com/<tenant>/v2.0` |
| `OIDC_CLIENT_ID` / `OIDC_CLIENT_SECRET` | From the Entra app registration ([entra-setup.md](entra-setup.md)). |
| `OIDC_REDIRECT_URI` | Defaults to `${BASE_URL}/auth/callback` — must match the Entra registration. |
| `ROLE_MAPPINGS` | JSON: Entra group id → role. |
| `DEFAULT_ROLE` | Fallback role (default `viewer`). |

Optional: `CORS_ORIGINS`, `DATABASE_SSL_STRICT=true` (enforce DB cert
validation), and connector config (`GRAPH_*`, `SHAREPOINT_LISTS`,
`CONNECTORS_DEMO=false`) — see [connectors.md](connectors.md).

Generate a session key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Example: image + Postgres with compose

```yaml
services:
  app:
    image: registry.example.com/power-app:1.0.0
    ports: ["8080:8080"]
    environment:
      DATABASE_URL: postgres://power:power@db:5432/power_app
      SESSION_KEYS: ${SESSION_KEYS}
      BASE_URL: https://app.example.com
      AUTH_MODE: entra
      OIDC_AUTHORITY: https://login.microsoftonline.com/<tenant>/v2.0
      OIDC_CLIENT_ID: ${OIDC_CLIENT_ID}
      OIDC_CLIENT_SECRET: ${OIDC_CLIENT_SECRET}
      ROLE_MAPPINGS: '{"<group-guid>":"admin"}'
    depends_on: [db]
  db:
    image: postgres:16
    environment:
      POSTGRES_USER: power
      POSTGRES_PASSWORD: power
      POSTGRES_DB: power_app
    volumes: ["pgdata:/var/lib/postgresql/data"]
volumes: { pgdata: {} }
```

## Migrations

Migrations are **idempotent and run automatically on container start**, so a
rolling deploy self-migrates. No separate migration step is required. (If IT
prefers a discrete migration job, that can be added as a compiled entrypoint —
ask and we'll wire it up.)

## Operating notes

- **Stateless**: sessions live in an encrypted cookie, so you can run multiple
  replicas behind a load balancer with no shared session store.
- **Health checks**: the image declares a `HEALTHCHECK`; orchestrators can also
  probe `/healthz` and `/readyz` directly.
- **Non-root**: runs as `node`; no privileged ports (listens on 8080).
- **TLS**: terminate TLS at the ingress/load balancer; set `BASE_URL` to the
  public `https://` URL so secure cookies and redirects are correct.

## Per-app images

Each app you build on the framework is its own repository/branch and produces
its **own image** from this Dockerfile — add your entities, connectors, and
migrations, then `docker build`. Nothing about the build changes as the app
grows.

> Note: this Dockerfile has not yet been build-tested in CI/locally in this
> environment (no Docker daemon was available). Run `docker build .` once in a
> Docker environment to confirm before handing the first image to IT; ping us if
> anything needs adjusting.
