import type { FastifyInstance } from "fastify";
import { permissionsFor, toEntityMeta } from "@power-app/core";
import { entities, getEntity } from "../entities/index.js";
import { requireAuth } from "../auth/plugin.js";

/**
 * Exposes entity metadata so the client can render forms and tables generically.
 * Permissions are computed for the current user and merged in, so the UI can
 * hide actions the user can't perform.
 */
export async function registerMetaRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/meta/entities", { preHandler: requireAuth }, async (req) => {
    return {
      entities: entities.map((def) => ({
        ...toEntityMeta(def),
        permissions: permissionsFor(req.user, def.access),
      })),
    };
  });

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
}
