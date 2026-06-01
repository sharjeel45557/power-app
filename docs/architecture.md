# Architecture

power-app is a **developer framework** for internal line-of-business apps, not a
no-code visual builder. Developers declare entities and compose UI; the
framework supplies auth, data, access control, audit, and (later) workflow and
connectors. It is TypeScript end-to-end and deploys as a single Cloud Foundry
app.

## Goals

- **Beautiful, unconstrained UI** — own the front end with React + Tailwind.
- **A real database** — PostgreSQL, not SharePoint Lists.
- **Microsoft SSO** — Entra ID via OIDC, roles from group claims.
- **Move fast** — one entity declaration yields API + form + table + RBAC + audit.
- **Cloud Foundry native** — 12-factor, stateless, config from the environment.
- **Healthcare-ready** — audit everything; keep PHI out of logs.

## Monorepo layout

```
packages/core      Framework core (no HTTP, no React):
                     - types         User, Role, Action, FieldMeta, EntityMeta
                     - rbac          can(), permissionsFor(), rolesFromGroups()
                     - entity        defineEntity(), toEntityMeta()
                     - config        loadConfig() incl. VCAP_SERVICES parsing
                   Exposes a browser-safe `@power-app/core/meta` entry (pure
                   types + RBAC) so the web bundle never pulls in server deps.

apps/server        Fastify host:
                     - auth/         Entra OIDC (openid-client) + mock + session
                     - db/           Drizzle + postgres-js, schema, migrator
                     - entities/     the entity registry (+ reference entity)
                     - routes/       generic CRUD engine, metadata, health
                     - audit.ts      append-only audit writer
                     - static.ts     serves the built SPA with SPA fallback

apps/web           React + Vite + Tailwind SPA:
                     - lib/          api client, auth context
                     - components/   UI primitives, Layout, EntityForm
                     - pages/        Login, Dashboard, EntityList, EntityForm
```

## Request flow

```
Browser ──▶ Fastify host ──▶ Postgres
   ▲            │
   │            ├─ /auth/*           OIDC login/logout, session cookie, /me
   │            ├─ /api/meta/*       entity metadata + per-user permissions
   │            ├─ /api/entities/*   generic CRUD (validate → authorize → audit)
   │            ├─ /healthz /readyz  CF probes
   └────────────┴─ /*                static SPA (production)
```

In development the SPA is served by Vite (`:5173`) which proxies `/api` and
`/auth` to the host (`:8080`), keeping the browser same-origin so the session
cookie "just works".

## The entity engine

`defineEntity()` pairs three things:

- a **Drizzle table** (where it persists),
- **Zod schemas** for create/update (validation), and
- **field metadata** + **access rules** (UI + authorization).

The generic router ([`routes/entities.ts`](../apps/server/src/routes/entities.ts))
implements list/read/create/update/delete once, against any registered entity:

1. resolve the entity from the URL, 404 if unknown;
2. `can(user, action, access)` → 403 if denied;
3. validate the body with the entity's Zod schema → 422 with issues;
4. run the Drizzle query (auto-setting `createdBy` / `updatedAt` when present);
5. write an audit record.

The metadata endpoint serialises each entity (`toEntityMeta`) plus the current
user's computed permissions, so the SPA renders forms/tables generically and
hides actions the user can't perform.

## Authentication & sessions

- **OIDC authorization-code flow + PKCE** against the Entra v2.0 issuer
  (`openid-client`). The handshake state (`state`, `nonce`, `code_verifier`) is
  held in the session between the redirect legs.
- Sessions live in an **encrypted, httpOnly cookie** (`@fastify/secure-session`)
  keyed by `SESSION_KEYS`. No server-side session store → horizontally scalable
  and Cloud-Foundry-friendly.
- **Roles** come from Entra group object-ids mapped via `ROLE_MAPPINGS`, with a
  `DEFAULT_ROLE` fallback.
- **Mock mode** (`AUTH_MODE=mock`) issues a deterministic dev user so the app is
  fully usable before Entra is registered. It is rejected in production config.

## Configuration

`loadConfig()` reads `process.env` first, then merges Cloud Foundry
`VCAP_SERVICES`:

- a bound Postgres service supplies `DATABASE_URL`;
- a user-provided service named `power-app-config` supplies secrets (Entra
  config, session keys) so nothing sensitive lives in the manifest.

Production startup fails fast if required values (session keys, Entra config)
are missing.

## Data & migrations

A small forward-only migrator ([`db/migrate.ts`](../apps/server/src/db/migrate.ts))
applies idempotent `*.sql` files from `apps/server/migrations/` exactly once,
tracked in a `_migrations` table. It runs automatically on boot and needs no
build-time snapshot, so `cf push` self-migrates. `drizzle-kit` is available for
authoring new migrations during development.

## Deliberate non-goals (for now)

- **No visual/no-code builder** — this is a developer framework by design.
- **No server-side session store** — encrypted cookies instead.
- **No SSR** — a static SPA served by the API host (simpler on Cloud Foundry).

## What's next

Workflow/approval engine, dashboards, and a scaffolding CLI (Phase 2);
SharePoint/Graph/SQL/FHIR connectors (Phase 3); tests, CI, CSP/CSRF, and a
security review (Phase 4). See the roadmap in the [README](../README.md).
