import type { FastifyInstance } from "fastify";
import type { DbHandle } from "../db/client.js";

/**
 * Liveness (`/healthz`) and readiness (`/readyz`) probes. The container's
 * HEALTHCHECK (and orchestrator probes) hit `/healthz`; readiness additionally
 * verifies the database.
 */
export async function registerHealthRoutes(
  app: FastifyInstance,
  dbHandle: DbHandle | null,
): Promise<void> {
  app.get("/healthz", async () => ({ status: "ok", uptime: process.uptime() }));

  app.get("/readyz", async (_req, reply) => {
    if (!dbHandle) {
      return reply.code(503).send({ status: "degraded", db: "not-configured" });
    }
    try {
      await dbHandle.sql`SELECT 1`;
      return reply.send({ status: "ok", db: "up" });
    } catch {
      return reply.code(503).send({ status: "degraded", db: "down" });
    }
  });
}
