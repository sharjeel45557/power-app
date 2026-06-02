# power-app

An in-house, developer-first framework for building internal line-of-business
apps — a **PowerApps replacement** for our organization. It exists to fix the
two things that hurt most about PowerApps:

1. **Limited, ugly UI** → we own the entire front end (React + Tailwind). Apps
   look and behave however we want, on any device.
2. **SharePoint Lists as the data layer** → the backbone is **PostgreSQL**, a
   real relational database. SharePoint becomes just *one optional connector*,
   never the foundation.

Authentication is **Microsoft Entra ID (Azure AD) SSO** via OpenID Connect.
Everything is built to run on **Cloud Foundry**.

> **Status: Phase 4 (Hardening) — feature-complete.** All four app patterns are
> in place (forms, lists/dashboards, approval workflows, integrations). Phase 4
> adds an automated **test suite** (unit + integration) with **CI**, **CSP +
> CSRF** hardening, a documented [security posture](SECURITY.md), and a seeded
> [sample app](docs/sample-app.md). See the [roadmap](#roadmap).

---

## What you get from one entity declaration

A developer declares an entity once (a Drizzle table + a Zod schema + field
metadata + access rules). In return, **for free**:

- a typed REST API (`list` / `read` / `create` / `update` / `delete`)
- server-side validation (422 with field-level errors)
- an auto-generated, validated **form**
- a filterable, paginated **data table**
- **role-based access control** derived from Entra group membership
- an append-only **audit trail** on every mutation
- an optional **approval workflow** (state machine) with per-role transitions

The reference entity lives in
[`apps/server/src/entities/requests.ts`](apps/server/src/entities/requests.ts)
and includes a five-state approval workflow. To add your own entity, either run
the scaffolder or write it by hand — see
[docs/adding-an-entity.md](docs/adding-an-entity.md):

```bash
pnpm scaffold new entity assets --fields "name:text:required,location:text,purchased:date"
```

For the workflow engine, see [docs/workflows.md](docs/workflows.md). To surface
external data (SharePoint, REST, FHIR) as apps, see
[docs/connectors.md](docs/connectors.md).

## Architecture at a glance

```
power-app/                 pnpm monorepo, TypeScript end-to-end
├─ apps/
│  ├─ server/              Fastify API host — auth, entity engine, audit, SPA serving
│  └─ web/                 React + Vite + Tailwind SPA (app shell + generated UIs)
├─ packages/
│  ├─ core/                Framework core: entity engine, RBAC, workflow, config
│  ├─ connectors/          Connector framework + SharePoint/REST/FHIR/in-memory
│  └─ cli/                 The `paf` scaffolding CLI
├─ manifest.yml            Cloud Foundry deployment
└─ docs/                   Setup & design docs
```

The Fastify host serves both the JSON API and the pre-built SPA, so the whole
thing is a single `cf push`. Full design notes:
[docs/architecture.md](docs/architecture.md).

## Quick start (local)

Requires **Node 22+**, **pnpm 10+**, and a **Postgres** instance.

```bash
# 1. install
pnpm install

# 2. start Postgres (Docker) and configure env
docker compose up -d
cp .env.example .env          # defaults work with docker compose

# 3. apply the database schema
pnpm db:migrate

# 4. run the API + web app together (mock auth — no Entra needed)
pnpm dev
```

- Web app: <http://localhost:5173> (proxies API/auth to the server)
- API host: <http://localhost:8080>

`AUTH_MODE=mock` (the default in `.env.example`) signs you in as a local dev
user so you can build the whole app **before IT registers Entra**. Switch to
`AUTH_MODE=entra` once you have an App Registration —
see [docs/entra-setup.md](docs/entra-setup.md).

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | Build core, then run server + web with hot reload |
| `pnpm build` | Production build of core, web, and server |
| `pnpm typecheck` | Typecheck every package |
| `pnpm test` | Run unit + integration tests (integration needs `DATABASE_URL`) |
| `pnpm test:unit` | Run unit tests only (no database) |
| `pnpm db:migrate` | Apply pending SQL migrations |
| `pnpm db:seed` | Insert sample Service Requests |
| `pnpm db:generate` | (dev) Diff schema → new migration via drizzle-kit |
| `pnpm scaffold new entity <name>` | Generate + wire up a new entity (the `paf` CLI) |
| `pnpm start` | Run the built server (serves API + SPA) |

## Deployment

Built for **Cloud Foundry**: `pnpm build` then `cf push`. Config (DB, Entra,
session keys) is read from the environment and `VCAP_SERVICES`, so no secrets
live in the repo. Full guide:
[docs/deployment-cloudfoundry.md](docs/deployment-cloudfoundry.md).

## Security & compliance

This is intended for healthcare use, so the foundation bakes in:

- **Entra SSO** with auth-code + PKCE; sessions in an encrypted, httpOnly cookie
  (no server-side session store needed — Cloud-Foundry-friendly).
- **RBAC** from Entra group claims, enforced server-side on every action.
- **Append-only audit log** of every mutation and auth event (no PHI in logs).
- A strict **Content-Security-Policy**, **CSRF** origin-checks on mutating
  requests, security headers (`helmet`/HSTS), rate limiting, and strict input
  validation.

Full details and known gaps are in [SECURITY.md](SECURITY.md). Testing approach:
[docs/testing.md](docs/testing.md).

## Roadmap

- **Phase 1 — Foundation** ✅ — monorepo, Entra/mock auth, RBAC, audit, Postgres,
  the generic entity engine, one reference app, Cloud Foundry manifest.
- **Phase 2 — App patterns** ✅ — declarative **workflow/approval engine** (state
  machine with per-role transitions, audited), a **stats/dashboard** layer, and
  the **`paf` scaffolding CLI**.
- **Phase 3 — Connectors** ✅ — external data behind one interface:
  **SharePoint** (Microsoft Graph, app-only), generic **REST**, and **FHIR**,
  surfaced through the same UI as native entities. See
  [docs/connectors.md](docs/connectors.md).
- **Phase 4 — Hardening** ✅ — unit + integration tests with CI, CSP + CSRF
  hardening, a documented [security posture](SECURITY.md), and a seeded
  [sample app](docs/sample-app.md) covering all four patterns.

### Production readiness checklist

Before going live, your team still needs to: register the Entra app
([entra-setup.md](docs/entra-setup.md)), provision Cloud Foundry + a Postgres
service ([deployment-cloudfoundry.md](docs/deployment-cloudfoundry.md)), supply
real secrets/session keys, and commission a penetration test (see
[SECURITY.md](SECURITY.md) for known gaps).
