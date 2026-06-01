# Testing

Tests use the **built-in Node test runner** (`node:test`) executed through
**tsx** (so TypeScript and `.js`-specifier ESM imports work with no extra
tooling). There are two tiers:

- **Unit tests** — pure, fast, no I/O. Cover `@power-app/core` (RBAC, workflow,
  config, entity metadata) and `@power-app/connectors` (registry, in-memory,
  REST/FHIR, SharePoint mapping, Graph token). They use stub `fetch`
  implementations to exercise connector logic without network access.
- **Integration tests** — boot the real Fastify app via `buildApp()` and drive
  it with `app.inject()` against a **Postgres** database. They cover auth, entity
  CRUD + validation, workflow transitions, RBAC, connectors, the unified sources
  endpoint, and the CSRF guard. They are **skipped automatically when
  `DATABASE_URL` is unset**, so unit tests still run anywhere.

## Running

```bash
# everything (integration tests run if DATABASE_URL is set)
DATABASE_URL=postgres://power:power@localhost:5432/power_app pnpm test

# unit tests only (no database needed)
pnpm test:unit
```

`pnpm test` first builds `@power-app/core` and `@power-app/connectors` (so
cross-package imports resolve to their built output), then runs every
`*.test.ts` under `packages/**/test` and `apps/**/test`.

## Layout

```
packages/core/test/         rbac, workflow, config, entity
packages/connectors/test/   registry, memory, token, sharepoint, rest
apps/server/test/           security (unit) + integration (Fastify + Postgres)
```

## CI

`.github/workflows/ci.yml` runs on every push and PR: it spins up a Postgres
service, installs with a frozen lockfile, then runs **typecheck → build → test**
(so the integration tier runs in CI too).

## Conventions

- Use `node:assert/strict`.
- Keep unit tests free of network and database access; inject stubs via the
  connector `ConnectorContext` (`fetch`, `getAppToken`).
- Integration tests must clean up rows they create (see the `after` hook in
  `integration.test.ts`).
