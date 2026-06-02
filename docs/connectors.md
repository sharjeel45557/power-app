# Connectors (external data)

Connectors let an app read and write data in **external systems** — SharePoint,
arbitrary REST APIs, FHIR servers — through the **same interface** as native
Postgres entities. To users they're just another app in the sidebar; the same
forms and tables render them. This is the fourth target app pattern, and the
direct path off SharePoint Lists.

## How it fits

- A **connector resource** (`packages/connectors`) implements `list` plus any of
  `get`/`create`/`update`/`remove`. Which methods exist determines its
  capabilities.
- The server exposes connectors under `/api/connectors/:resource/...`, mirroring
  the entity API, with the same **RBAC** and **audit logging**.
- `/api/meta/sources` returns entities and connectors together as `SourceMeta`,
  so the web renders both with one set of components.
- Per-user permissions for a connector are `role allows AND the resource
  supports the action`, so the UI hides what can't be done.

```
Browser ─▶ /api/connectors/:resource ─▶ ConnectorResource ─▶ external system
                     │                          (SharePoint / REST / FHIR)
                     └─ RBAC + audit (same as entities)
```

## Microsoft Graph / SharePoint

The SharePoint connector reads/writes a list via Microsoft Graph using
**app-only** (client-credentials) auth. The app's service principal accesses the
list and power-app enforces its own RBAC — so **end users get the data through
the app without needing direct SharePoint permissions** (the original pain
point). The token is acquired and cached automatically.

### Configure

1. Add **application** Graph permissions to your Entra app registration (e.g.
   `Sites.Selected` or `Sites.ReadWrite.All`) and grant admin consent. See
   [entra-setup.md](entra-setup.md).
2. Provide Graph credentials (these default to the OIDC app + tenant, so often
   nothing extra is needed beyond consent):
   ```bash
   GRAPH_TENANT_ID=<tenant-guid>      # defaults to the OIDC tenant
   GRAPH_CLIENT_ID=<client-id>        # defaults to OIDC_CLIENT_ID
   GRAPH_CLIENT_SECRET=<secret>       # defaults to OIDC_CLIENT_SECRET
   ```
3. Declare the lists to expose via `SHAREPOINT_LISTS` (JSON). Each maps fields to
   SharePoint **internal column names**:
   ```json
   [
     {
       "name": "equipment",
       "label": "Equipment",
       "labelSingular": "Equipment Item",
       "siteId": "contoso.sharepoint.com,<siteCollectionId>,<webId>",
       "listId": "<list-guid-or-name>",
       "access": { "list": "*", "read": "*", "create": ["admin","editor"], "update": ["admin","editor"], "delete": ["admin"] },
       "fields": [
         { "name": "title", "label": "Title", "type": "text", "required": true, "showInTable": true, "column": "Title" },
         { "name": "vendor", "label": "Vendor", "type": "text", "showInTable": true, "column": "Vendor" }
       ]
     }
   ]
   ```
   Mark a list `"readOnly": true` to expose only list/read.

> **Finding ids.** `siteId`: `GET /sites/{hostname}:/sites/{path}`. `listId`:
> `GET /sites/{siteId}/lists`. Column internal names: `GET
> /sites/{siteId}/lists/{listId}/columns`.

## Generic REST and FHIR

`restConnectorResource()` wraps any JSON API: configure `baseUrl`, optional
`headers` (auth), `dataPath` (where the array lives in the list response),
`idField`, and an optional `mapItem`. `fhirResource()` is a read-only preset for
FHIR servers (lists `Bundle.entry[].resource`, reads by id). These are declared
in code today; config-driven REST endpoints can follow the SharePoint pattern.

## Dev / demo connector

When `CONNECTORS_DEMO=true` (default outside production) an in-memory
**Vendor Contacts** connector is registered. It stands in for a SharePoint list
with full CRUD so the whole pipeline — sidebar, tables, forms, RBAC, audit — is
exercisable with no external system. State resets on restart.

## Limitations (current)

- SharePoint list paging fetches the first page sized to the request (Graph uses
  `@odata.nextLink`, not `$skip`); deep pagination is a follow-up.
- No server-side validation layer for connector writes yet (the external system
  validates); Zod schemas for connectors are a candidate for Phase 4.
- FHIR mapping projects top-level fields; supply a custom `mapItem` for nested
  paths.
