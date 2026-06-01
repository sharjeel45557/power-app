import {
  ConnectorError,
  resourceCapabilities,
  type ConnectorResource,
} from "@power-app/connectors";
import { can, type Action, type User } from "@power-app/core";
import type { FastifyInstance, FastifyReply } from "fastify";
import type { Db } from "../db/client.js";
import { writeAudit } from "../audit.js";
import { requireAuth } from "../auth/plugin.js";
import type { ConnectorRuntime } from "../connectors/setup.js";

interface Deps {
  db: Db | null;
  runtime: ConnectorRuntime;
}

const MAX_PAGE_SIZE = 100;

function parsePaging(query: Record<string, unknown>) {
  const page = Math.max(1, Number(query.page ?? 1) || 1);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number(query.pageSize ?? 25) || 25),
  );
  return { page, pageSize };
}

type GuardResult<T> = { ok: true; value: T } | { ok: false };

/** Runs a connector op, mapping failures to HTTP responses on `reply`. */
async function guard<T>(
  reply: FastifyReply,
  fn: () => Promise<T>,
): Promise<GuardResult<T>> {
  try {
    return { ok: true, value: await fn() };
  } catch (err) {
    if (err instanceof ConnectorError) {
      const status = err.status >= 400 && err.status < 600 ? err.status : 502;
      reply.code(status).send({ error: err.message });
    } else {
      reply.log.error({ err }, "connector operation failed");
      reply.code(502).send({ error: "Connector request failed." });
    }
    return { ok: false };
  }
}

export async function registerConnectorRoutes(
  app: FastifyInstance,
  { db, runtime }: Deps,
): Promise<void> {
  app.addHook("preHandler", async (req, reply) => {
    if (req.url.startsWith("/api/connectors")) return requireAuth(req, reply);
    return undefined;
  });

  /** Resolves a resource and checks role + capability for an action. */
  const authorize = (
    reply: FastifyReply,
    name: string,
    user: User | null,
    action: Action,
  ): ConnectorResource | null => {
    const resource = runtime.registry.get(name);
    if (!resource) {
      reply.code(404).send({ error: "Unknown connector." });
      return null;
    }
    if (!can(user, action, resource.access)) {
      reply.code(403).send({ error: "Forbidden." });
      return null;
    }
    if (!resourceCapabilities(resource)[action]) {
      reply.code(405).send({ error: `"${action}" is not supported here.` });
      return null;
    }
    return resource;
  };

  // ── List ──────────────────────────────────────────────────────────────────
  app.get<{ Params: { resource: string }; Querystring: Record<string, string> }>(
    "/api/connectors/:resource",
    async (req, reply) => {
      const resource = authorize(reply, req.params.resource, req.user, "list");
      if (!resource) return reply;
      const { page, pageSize } = parsePaging(req.query);
      const result = await guard(reply, () =>
        resource.list(runtime.makeContext(req.user), { page, pageSize }),
      );
      if (!result.ok) return reply;
      return reply.send(result.value);
    },
  );

  // ── Read ──────────────────────────────────────────────────────────────────
  app.get<{ Params: { resource: string; id: string } }>(
    "/api/connectors/:resource/:id",
    async (req, reply) => {
      const resource = authorize(reply, req.params.resource, req.user, "read");
      if (!resource) return reply;
      const result = await guard(reply, () =>
        resource.get!(runtime.makeContext(req.user), req.params.id),
      );
      if (!result.ok) return reply;
      if (result.value === null) return reply.code(404).send({ error: "Not found." });
      return reply.send({ data: result.value });
    },
  );

  // ── Create ────────────────────────────────────────────────────────────────
  app.post<{ Params: { resource: string }; Body: Record<string, unknown> }>(
    "/api/connectors/:resource",
    async (req, reply) => {
      const resource = authorize(reply, req.params.resource, req.user, "create");
      if (!resource) return reply;
      const result = await guard(reply, () =>
        resource.create!(runtime.makeContext(req.user), req.body ?? {}),
      );
      if (!result.ok) return reply;
      if (db)
        await writeAudit(db, req.user, {
          action: "create",
          entity: resource.name,
          entityId: result.value.id,
          summary: `Created ${resource.labelSingular}`,
          metadata: { connector: resource.source },
        });
      return reply.code(201).send({ data: result.value });
    },
  );

  // ── Update ────────────────────────────────────────────────────────────────
  app.patch<{
    Params: { resource: string; id: string };
    Body: Record<string, unknown>;
  }>("/api/connectors/:resource/:id", async (req, reply) => {
    const resource = authorize(reply, req.params.resource, req.user, "update");
    if (!resource) return reply;
    const result = await guard(reply, () =>
      resource.update!(runtime.makeContext(req.user), req.params.id, req.body ?? {}),
    );
    if (!result.ok) return reply;
    if (db)
      await writeAudit(db, req.user, {
        action: "update",
        entity: resource.name,
        entityId: req.params.id,
        summary: `Updated ${resource.labelSingular}`,
        metadata: { connector: resource.source, fields: Object.keys(req.body ?? {}) },
      });
    return reply.send({ data: result.value });
  });

  // ── Delete ────────────────────────────────────────────────────────────────
  app.delete<{ Params: { resource: string; id: string } }>(
    "/api/connectors/:resource/:id",
    async (req, reply) => {
      const resource = authorize(reply, req.params.resource, req.user, "delete");
      if (!resource) return reply;
      const result = await guard(reply, () =>
        resource.remove!(runtime.makeContext(req.user), req.params.id),
      );
      if (!result.ok) return reply;
      if (db)
        await writeAudit(db, req.user, {
          action: "delete",
          entity: resource.name,
          entityId: req.params.id,
          summary: `Deleted ${resource.labelSingular}`,
          metadata: { connector: resource.source },
        });
      return reply.send({ ok: true });
    },
  );
}
