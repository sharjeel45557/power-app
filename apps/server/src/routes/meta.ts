import { resourceCapabilities, type ConnectorResource } from "@power-app/connectors";
import {
  can,
  permissionsFor,
  toEntityMeta,
  type Action,
  type SourceMeta,
  type User,
} from "@power-app/core";
import type { FastifyInstance } from "fastify";
import { entities, getEntity } from "../entities/index.js";
import { requireAuth } from "../auth/plugin.js";
import type { ConnectorRuntime } from "../connectors/setup.js";

const ACTIONS: Action[] = ["list", "read", "create", "update", "delete"];

/** Connector permissions = role allows AND the resource supports the action. */
function connectorSourceMeta(
  resource: ConnectorResource,
  user: User | null,
): SourceMeta {
  const caps = resourceCapabilities(resource);
  const permissions = {} as Record<Action, boolean>;
  for (const action of ACTIONS) {
    permissions[action] = can(user, action, resource.access) && caps[action];
  }
  return {
    kind: "connector",
    name: resource.name,
    label: resource.label,
    labelSingular: resource.labelSingular,
    source: resource.source,
    fields: resource.fields,
    permissions,
  };
}

interface Deps {
  runtime: ConnectorRuntime;
}

/**
 * Metadata endpoints so the client can render forms/tables generically:
 *   - /api/meta/entities[/:entity]      native Postgres entities
 *   - /api/meta/connectors/:resource    external connector resources
 *   - /api/meta/sources                 unified list of both (for navigation)
 */
export async function registerMetaRoutes(
  app: FastifyInstance,
  { runtime }: Deps,
): Promise<void> {
  app.get("/api/meta/entities", { preHandler: requireAuth }, async (req) => ({
    entities: entities.map((def) => ({
      ...toEntityMeta(def),
      permissions: permissionsFor(req.user, def.access),
    })),
  }));

  app.get<{ Params: { entity: string } }>(
    "/api/meta/entities/:entity",
    { preHandler: requireAuth },
    async (req, reply) => {
      const def = getEntity(req.params.entity);
      if (!def) return reply.code(404).send({ error: "Unknown entity." });
      return reply.send({
        entity: {
          ...toEntityMeta(def),
          permissions: permissionsFor(req.user, def.access),
        },
      });
    },
  );

  app.get<{ Params: { resource: string } }>(
    "/api/meta/connectors/:resource",
    { preHandler: requireAuth },
    async (req, reply) => {
      const resource = runtime.registry.get(req.params.resource);
      if (!resource) return reply.code(404).send({ error: "Unknown connector." });
      return reply.send({ entity: connectorSourceMeta(resource, req.user) });
    },
  );

  // Unified navigation list: entities + connectors, with per-user permissions.
  app.get("/api/meta/sources", { preHandler: requireAuth }, async (req) => {
    const entitySources: SourceMeta[] = entities.map((def) => ({
      kind: "entity",
      ...toEntityMeta(def),
      permissions: permissionsFor(req.user, def.access),
    }));
    const connectorSources: SourceMeta[] = runtime.registry
      .list()
      .map((r) => connectorSourceMeta(r, req.user));
    return { sources: [...entitySources, ...connectorSources] };
  });
}
