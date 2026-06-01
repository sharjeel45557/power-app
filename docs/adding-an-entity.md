# Adding an entity

An "entity" is a data type your app manages — the unit that replaces a
PowerApps screen + SharePoint List. Declaring one gives you a REST API, a
validated form, a filterable table, RBAC, and audit logging automatically.

This walks through adding an `assets` entity (tracking equipment). It mirrors
the reference entity in
[`apps/server/src/entities/requests.ts`](../apps/server/src/entities/requests.ts).

## 1. Define the table (Drizzle)

In [`apps/server/src/db/schema.ts`](../apps/server/src/db/schema.ts):

```ts
export const assets = pgTable("assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  tag: text("tag").notNull(),
  location: text("location"),
  status: text("status").notNull().default("in_service"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
```

> `createdBy` and `updatedAt` are conventional: the engine auto-fills them when
> present (sets `createdBy` from the session on create, bumps `updatedAt` on
> update).

## 2. Add a migration

Create `apps/server/migrations/0002_assets.sql` with idempotent DDL:

```sql
CREATE TABLE IF NOT EXISTS assets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  tag         text NOT NULL,
  location    text,
  status      text NOT NULL DEFAULT 'in_service',
  created_by  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
```

It applies automatically on the next boot (or run `pnpm db:migrate`). You can
also generate migrations from the schema with `pnpm db:generate`.

## 3. Declare the entity

Create `apps/server/src/entities/assets.ts`:

```ts
import { z } from "zod";
import { defineEntity } from "@power-app/core";
import { assets } from "../db/schema.js";

const statuses = ["in_service", "in_repair", "retired"] as const;

const createSchema = z.object({
  name: z.string().trim().min(2).max(200),
  tag: z.string().trim().min(1).max(64),
  location: z.string().max(200).optional().nullable(),
  status: z.enum(statuses).optional(),
});

export const assetsEntity = defineEntity({
  name: "assets",
  label: "Assets",
  labelSingular: "Asset",
  table: assets,
  createSchema,
  updateSchema: createSchema.partial(),
  defaultSort: { field: "createdAt", dir: "desc" },
  fields: [
    { name: "name", label: "Name", type: "text", required: true, showInTable: true },
    { name: "tag", label: "Asset Tag", type: "text", required: true, showInTable: true },
    { name: "location", label: "Location", type: "text", showInTable: true },
    {
      name: "status",
      label: "Status",
      type: "select",
      showInTable: true,
      options: statuses.map((s) => ({ value: s, label: s.replace(/_/g, " ") })),
    },
    { name: "createdBy", label: "Created By", type: "text", readOnly: true, showInTable: true },
  ],
  access: {
    list: "*",
    read: "*",
    create: ["admin", "editor"],
    update: ["admin", "editor"],
    delete: ["admin"],
  },
});
```

## 4. Register it

Add it to the registry in
[`apps/server/src/entities/index.ts`](../apps/server/src/entities/index.ts):

```ts
import { assetsEntity } from "./assets.js";

export const entities: EntityDefinition[] = [requestsEntity, assetsEntity];
```

## Done

Restart the dev server. You now have:

- `GET/POST /api/entities/assets`, `GET/PATCH/DELETE /api/entities/assets/:id`
- `GET /api/meta/entities/assets`
- a sidebar entry, an auto-generated table at `/e/assets`, and a form at
  `/e/assets/new`
- RBAC enforced server-side, and create/update/delete written to the audit log

## Field types

`text` · `textarea` · `email` · `number` · `boolean` · `date` · `datetime` ·
`select` (with `options`). Field metadata also supports `required`,
`showInTable`, `readOnly`, `helpText`, and `placeholder`.

## Access rules

Per action (`list`/`read`/`create`/`update`/`delete`):

- `"*"` — any authenticated user
- `["admin", "editor"]` — users holding at least one of these roles
- `(user) => boolean` — a custom predicate

An action with **no** rule is denied by default.
