import { asc, desc, eq, getTableColumns, sql } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import type { FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { can, type Action, type EntityDefinition } from "@power-app/core";
import type { Db } from "../db/client.js";
import { writeAudit } from "../audit.js";
import { getEntity } from "../entities/index.js";
import { requireAuth } from "../auth/plugin.js";

interface Deps {
  db: Db;
}

const MAX_PAGE_SIZE = 100;

function parsePaging(query: Record<string, unknown>): {
  limit: number;
  offset: number;
  page: number;
  pageSize: number;
} {
  const page = Math.max(1, Number(query.page ?? 1) || 1);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number(query.pageSize ?? 25) || 25),
  );
  return { limit: pageSize, offset: (page - 1) * pageSize, page, pageSize };
}

/** Looks up a column by name, guarding the dynamic access. */
function column(
  cols: Record<string, PgColumn>,
  name: string,
): PgColumn | undefined {
  return Object.prototype.hasOwnProperty.call(cols, name)
    ? cols[name]
    : undefined;
}

export async function registerEntityRoutes(
  app: FastifyInstance,
  { db }: Deps,
): Promise<void> {
  // All entity routes require authentication.
  app.addHook("preHandler", async (req, reply) => {
    if (req.url.startsWith("/api/entities")) return requireAuth(req, reply);
    return undefined;
  });

  const resolve = (
    name: string,
  ): { def: EntityDefinition; cols: Record<string, PgColumn> } | null => {
    const def = getEntity(name);
    if (!def) return null;
    return { def, cols: getTableColumns(def.table) as Record<string, PgColumn> };
  };

  const denied = (
    req: { user: import("@power-app/core").User | null },
    def: EntityDefinition,
    action: Action,
  ): boolean => !can(req.user, action, def.access);

  // ── List ──────────────────────────────────────────────────────────────────
  app.get<{ Params: { entity: string }; Querystring: Record<string, string> }>(
    "/api/entities/:entity",
    async (req, reply) => {
      const resolved = resolve(req.params.entity);
      if (!resolved) return reply.code(404).send({ error: "Unknown entity." });
      const { def, cols } = resolved;
      if (denied(req, def, "list"))
        return reply.code(403).send({ error: "Forbidden." });

      const { limit, offset, page, pageSize } = parsePaging(req.query);

      let q = db.select().from(def.table).$dynamic();
      const sortField = def.defaultSort?.field;
      const sortCol = sortField ? column(cols, sortField) : undefined;
      if (sortCol) {
        q = q.orderBy(def.defaultSort?.dir === "asc" ? asc(sortCol) : desc(sortCol));
      }

      const rows = await q.limit(limit).offset(offset);
      const countRows = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(def.table);
      const total = countRows[0]?.count ?? 0;

      return reply.send({ data: rows, page, pageSize, total });
    },
  );

  // ── Read ──────────────────────────────────────────────────────────────────
  app.get<{ Params: { entity: string; id: string } }>(
    "/api/entities/:entity/:id",
    async (req, reply) => {
      const resolved = resolve(req.params.entity);
      if (!resolved) return reply.code(404).send({ error: "Unknown entity." });
      const { def, cols } = resolved;
      if (denied(req, def, "read"))
        return reply.code(403).send({ error: "Forbidden." });

      const idCol = column(cols, "id");
      if (!idCol) return reply.code(500).send({ error: "Entity has no id column." });

      const [row] = await db
        .select()
        .from(def.table)
        .where(eq(idCol, req.params.id))
        .limit(1);
      if (!row) return reply.code(404).send({ error: "Not found." });
      return reply.send({ data: row });
    },
  );

  // ── Create ────────────────────────────────────────────────────────────────
  app.post<{ Params: { entity: string }; Body: unknown }>(
    "/api/entities/:entity",
    async (req, reply) => {
      const resolved = resolve(req.params.entity);
      if (!resolved) return reply.code(404).send({ error: "Unknown entity." });
      const { def, cols } = resolved;
      if (denied(req, def, "create"))
        return reply.code(403).send({ error: "Forbidden." });

      let values: Record<string, unknown>;
      try {
        values = { ...(def.createSchema.parse(req.body) as object) };
      } catch (err) {
        return reply.code(422).send(validationError(err));
      }

      if (column(cols, "createdBy") && req.user) values.createdBy = req.user.email;

      const [row] = await db
        .insert(def.table)
        .values(values as never)
        .returning();

      await writeAudit(db, req.user, {
        action: "create",
        entity: def.name,
        entityId: rowId(row),
        summary: `Created ${def.labelSingular}`,
      });
      return reply.code(201).send({ data: row });
    },
  );

  // ── Update ────────────────────────────────────────────────────────────────
  app.patch<{ Params: { entity: string; id: string }; Body: unknown }>(
    "/api/entities/:entity/:id",
    async (req, reply) => {
      const resolved = resolve(req.params.entity);
      if (!resolved) return reply.code(404).send({ error: "Unknown entity." });
      const { def, cols } = resolved;
      if (denied(req, def, "update"))
        return reply.code(403).send({ error: "Forbidden." });

      const idCol = column(cols, "id");
      if (!idCol) return reply.code(500).send({ error: "Entity has no id column." });

      let values: Record<string, unknown>;
      try {
        values = { ...(def.updateSchema.parse(req.body) as object) };
      } catch (err) {
        return reply.code(422).send(validationError(err));
      }
      if (column(cols, "updatedAt")) values.updatedAt = new Date();

      const [row] = await db
        .update(def.table)
        .set(values as never)
        .where(eq(idCol, req.params.id))
        .returning();
      if (!row) return reply.code(404).send({ error: "Not found." });

      await writeAudit(db, req.user, {
        action: "update",
        entity: def.name,
        entityId: req.params.id,
        summary: `Updated ${def.labelSingular}`,
        metadata: { fields: Object.keys(values) },
      });
      return reply.send({ data: row });
    },
  );

  // ── Delete ────────────────────────────────────────────────────────────────
  app.delete<{ Params: { entity: string; id: string } }>(
    "/api/entities/:entity/:id",
    async (req, reply) => {
      const resolved = resolve(req.params.entity);
      if (!resolved) return reply.code(404).send({ error: "Unknown entity." });
      const { def, cols } = resolved;
      if (denied(req, def, "delete"))
        return reply.code(403).send({ error: "Forbidden." });

      const idCol = column(cols, "id");
      if (!idCol) return reply.code(500).send({ error: "Entity has no id column." });

      const [row] = await db
        .delete(def.table)
        .where(eq(idCol, req.params.id))
        .returning();
      if (!row) return reply.code(404).send({ error: "Not found." });

      await writeAudit(db, req.user, {
        action: "delete",
        entity: def.name,
        entityId: req.params.id,
        summary: `Deleted ${def.labelSingular}`,
      });
      return reply.send({ ok: true });
    },
  );
}

function rowId(row: unknown): string | undefined {
  if (row && typeof row === "object" && "id" in row) {
    return String((row as { id: unknown }).id);
  }
  return undefined;
}

function validationError(err: unknown) {
  if (err instanceof ZodError) {
    return { error: "Validation failed.", issues: err.issues };
  }
  return { error: "Invalid request body." };
}
