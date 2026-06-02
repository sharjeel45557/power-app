import { asc, count, desc, eq, getTableColumns, sql } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import type { FastifyInstance } from "fastify";
import { ZodError } from "zod";
import {
  can,
  canFireFrom,
  findTransition,
  userCanTransition,
  type Action,
  type EntityDefinition,
} from "@power-app/core";
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

      // Seed the workflow's initial state when the entity has one.
      if (def.workflow && values[def.workflow.field] === undefined) {
        values[def.workflow.field] = def.workflow.initial;
      }

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

  // ── Workflow transition ─────────────────────────────────────────────────────
  app.post<{
    Params: { entity: string; id: string };
    Body: { transition?: string; note?: string };
  }>("/api/entities/:entity/:id/transitions", async (req, reply) => {
    const resolved = resolve(req.params.entity);
    if (!resolved) return reply.code(404).send({ error: "Unknown entity." });
    const { def, cols } = resolved;

    const workflow = def.workflow;
    if (!workflow)
      return reply.code(400).send({ error: "Entity has no workflow." });

    // Reading is the minimum bar to see the record; transition roles gate the rest.
    if (!can(req.user, "read", def.access))
      return reply.code(403).send({ error: "Forbidden." });

    const transitionName = req.body?.transition;
    const transition = transitionName
      ? findTransition(workflow, transitionName)
      : null;
    if (!transition)
      return reply.code(400).send({ error: "Unknown transition." });

    const idCol = column(cols, "id");
    const stateCol = column(cols, workflow.field);
    if (!idCol || !stateCol)
      return reply.code(500).send({ error: "Workflow misconfigured." });

    const [row] = await db
      .select()
      .from(def.table)
      .where(eq(idCol, req.params.id))
      .limit(1);
    if (!row) return reply.code(404).send({ error: "Not found." });

    const current = String((row as Record<string, unknown>)[workflow.field]);
    if (!canFireFrom(transition, current)) {
      return reply
        .code(409)
        .send({ error: `Cannot "${transition.name}" from "${current}".` });
    }
    if (!userCanTransition(req.user, transition)) {
      return reply.code(403).send({ error: "Forbidden." });
    }
    const note = typeof req.body?.note === "string" ? req.body.note.trim() : "";
    if (transition.requireNote && !note) {
      return reply
        .code(422)
        .send({ error: "A note is required for this transition." });
    }

    const values: Record<string, unknown> = { [workflow.field]: transition.to };
    if (column(cols, "updatedAt")) values.updatedAt = new Date();

    const [updated] = await db
      .update(def.table)
      .set(values as never)
      .where(eq(idCol, req.params.id))
      .returning();

    await writeAudit(db, req.user, {
      action: "transition",
      entity: def.name,
      entityId: req.params.id,
      summary: `${def.labelSingular}: ${current} → ${transition.to}`,
      metadata: {
        from: current,
        to: transition.to,
        transition: transition.name,
        ...(note ? { note } : {}),
      },
    });
    return reply.send({ data: updated });
  });

  // ── Aggregate stats (grouped counts) ────────────────────────────────────────
  app.get<{
    Params: { entity: string };
    Querystring: { groupBy?: string };
  }>("/api/entities/:entity/stats", async (req, reply) => {
    const resolved = resolve(req.params.entity);
    if (!resolved) return reply.code(404).send({ error: "Unknown entity." });
    const { def, cols } = resolved;
    if (!can(req.user, "list", def.access))
      return reply.code(403).send({ error: "Forbidden." });

    const totalRows = await db
      .select({ value: count() })
      .from(def.table);
    const total = totalRows[0]?.value ?? 0;

    const groupBy = req.query.groupBy;
    let buckets: { value: string; count: number }[] = [];
    if (groupBy) {
      const groupCol = column(cols, groupBy);
      if (!groupCol)
        return reply.code(400).send({ error: `Unknown field "${groupBy}".` });
      const rows = await db
        .select({ value: groupCol, count: count() })
        .from(def.table)
        .groupBy(groupCol);
      buckets = rows.map((r) => ({ value: String(r.value), count: r.count }));
    }

    return reply.send({ total, groupBy: groupBy ?? null, buckets });
  });
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
