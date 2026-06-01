# Sample app: a walkthrough of all four patterns

The repo ships a working sample that exercises the four target app patterns —
the same patterns that motivated replacing PowerApps. Use it to see the
framework end to end.

## Set up

```bash
pnpm install
docker compose up -d                 # Postgres
cp .env.example .env                  # mock auth, demo connector on
pnpm db:migrate                       # create tables
pnpm db:seed                          # add sample Service Requests
pnpm dev                              # http://localhost:5173
```

Sign in with **Sign in with Microsoft** (mock mode signs you in as a dev admin).

## 1. Data-entry forms over a database

Open **Service Requests** → **New Service Request**. The form is generated from
the entity's field metadata, validated with Zod on submit (try a 2-character
title to see field-level errors), and written to **Postgres** — not SharePoint.
`createdBy` is set from your session automatically.

→ Defined in `apps/server/src/entities/requests.ts`. Add your own with
`pnpm scaffold new entity ...` ([adding-an-entity.md](adding-an-entity.md)).

## 2. Lists, dashboards & reports

The **Dashboard** shows a tile per data source with totals and, for entities
with a workflow, a live **status breakdown** (via `/stats`). **Service Requests**
is a filterable, paginated table generated from the same metadata.

## 3. Approval workflows

Open any request. The **Workflow** panel shows the current status and the
transitions available to you. As an admin: *Start review → Approve / Reject*
(Reject requires a note). Illegal moves are refused; every transition is written
to the audit log with `from`/`to`. The status field can't be edited directly —
only the workflow changes it.

→ See [workflows.md](workflows.md).

## 4. Integrations to other systems

**Vendor Contacts** under **Connected data** is a connector. In dev it's an
in-memory stand-in for a SharePoint list with full CRUD, so it behaves exactly
like the real Graph-backed connector. Point it at a real SharePoint list by
setting `GRAPH_*` + `SHAREPOINT_LISTS` ([connectors.md](connectors.md)); the UI
doesn't change. REST and FHIR sources work the same way.

## What ties it together

Every one of these is rendered by the **same** components and protected by the
**same** RBAC and audit logging — whether the data lives in Postgres or an
external system. That uniformity is the point: one platform, one UI, your data
in a real database, Microsoft SSO, and no PowerApps licensing.
