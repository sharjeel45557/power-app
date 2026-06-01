# Security

power-app is intended for internal, healthcare-adjacent line-of-business apps,
so security is built into the foundation rather than bolted on. This documents
the current posture and how to report issues.

## Authentication & sessions

- **Microsoft Entra ID SSO** via OpenID Connect, authorization-code flow with
  **PKCE**. The handshake `state`/`nonce`/`code_verifier` live in the session
  between redirect legs and are single-use.
- Sessions are stored in an **encrypted, signed, HttpOnly cookie**
  (`@fastify/secure-session`) keyed by `SESSION_KEYS` (32-byte keys, rotatable
  via a comma-separated list). No server-side session store, so there's no
  session datastore to breach and scaling stays trivial.
- Cookies are `SameSite=Lax`, `HttpOnly`, and `Secure` in production.
- A **mock auth** mode exists for local development only; production config
  (`AUTH_MODE=entra`) is validated at startup and the app refuses to start
  without the required OIDC values.

## Authorization

- **Role-based access control** derived from Entra **security-group** claims via
  `ROLE_MAPPINGS`, enforced **server-side on every action** (`can()` in
  `@power-app/core`). Deny-by-default: an action with no rule is forbidden.
- The same checks gate native entities, workflow transitions, and connectors.
  For connectors, a user may act only if their role allows it **and** the
  resource supports the operation.
- Workflow transitions have **independent** role gates, so approvers can advance
  records without broad edit rights.

## Request hardening

- **CSP**: a strict Content-Security-Policy (`script-src 'self'`, no inline
  scripts) via `helmet`, plus HSTS, `X-Content-Type-Options: nosniff`,
  `X-Frame-Options`, and frame-ancestors `'self'`.
- **CSRF**: mutating requests (`POST`/`PUT`/`PATCH`/`DELETE`) are rejected unless
  their `Origin` matches an allowed origin. Combined with the `SameSite=Lax`
  cookie and the JSON content type (which forces a cross-origin preflight), this
  blocks classic CSRF. See `apps/server/src/security.ts`.
- **Rate limiting** (`@fastify/rate-limit`) and a request **body size limit**.
- **Input validation** with Zod on every entity write; failures return `422`
  with field-level detail and never reach the database.

## Auditing (HIPAA-style accountability)

- An **append-only audit log** records every mutation and auth event: who
  (`actor_email`/`actor_id`), what (`action`/`entity`/`entity_id`), when, and a
  short summary. Workflow transitions record `from`/`to`. Connector writes are
  tagged with the source system.
- **No PHI in logs.** Audit `summary`/`metadata` and application logs must not
  contain protected health information.

## Secrets & configuration

- No secrets in the repo. Config is read from the environment and, on Cloud
  Foundry, from `VCAP_SERVICES` (bound DB) and a `power-app-config`
  user-provided service (OIDC secret, session keys).
- Microsoft Graph access for connectors is **app-only** (client credentials);
  prefer least-privilege Graph permissions (e.g. `Sites.Selected`).

## Known gaps / roadmap

- Connector writes are validated by the target system, not yet by a Zod schema
  in power-app.
- SharePoint list pagination fetches the first page only (Graph `nextLink`
  paging is a follow-up).
- A formal third-party penetration test has not been performed.

## Reporting a vulnerability

Please report security issues privately to the maintainers (do not open a public
issue). Include reproduction steps and impact. We aim to acknowledge within a
few business days.
