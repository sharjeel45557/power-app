import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyInstance } from "fastify";
import type { AppConfig } from "@power-app/core";
import { createDb, type DbHandle } from "./db/client.js";
import { runMigrations } from "./db/migrate.js";
import { registerAuth } from "./auth/plugin.js";
import { contentSecurityPolicy, registerCsrfGuard } from "./security.js";
import { setupConnectors } from "./connectors/setup.js";
import { registerConnectorRoutes } from "./routes/connectors.js";
import { registerEntityRoutes } from "./routes/entities.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerMetaRoutes } from "./routes/meta.js";
import { registerStatic } from "./static.js";

export interface BuiltApp {
  app: FastifyInstance;
  dbHandle: DbHandle | null;
  close: () => Promise<void>;
}

/** Wires the full application: db + migrations, security, auth, routes, SPA. */
export async function buildApp(config: AppConfig): Promise<BuiltApp> {
  const app = Fastify({
    logger: { level: process.env.LOG_LEVEL ?? "info" },
    trustProxy: true, // Cloud Foundry / reverse proxies
    bodyLimit: 1_000_000,
  });

  // ── Database + migrations ─────────────────────────────────────────────────
  let dbHandle: DbHandle | null = null;
  if (config.databaseUrl) {
    dbHandle = createDb(config);
    await runMigrations(dbHandle.sql, (msg) => app.log.info(`[migrate] ${msg}`));
  } else {
    app.log.warn("No DATABASE_URL configured — entity routes are disabled.");
  }

  // ── Security middleware ───────────────────────────────────────────────────
  await app.register(helmet, { contentSecurityPolicy });
  await app.register(cors, {
    origin: config.corsOrigins,
    credentials: true,
  });
  await app.register(rateLimit, {
    max: 300,
    timeWindow: "1 minute",
  });
  // CSRF: reject cross-origin mutating requests (see security.ts).
  registerCsrfGuard(app, config);

  // ── Auth (session + Entra/mock) ───────────────────────────────────────────
  await registerAuth(app, { config, db: dbHandle?.db ?? null });

  // ── Connectors (SharePoint / REST / FHIR / demo) ──────────────────────────
  const connectors = setupConnectors(config, (msg) => app.log.info(msg));

  // ── Routes ────────────────────────────────────────────────────────────────
  await registerHealthRoutes(app, dbHandle);
  await registerMetaRoutes(app, { runtime: connectors });
  await registerConnectorRoutes(app, {
    db: dbHandle?.db ?? null,
    runtime: connectors,
  });
  if (dbHandle) {
    await registerEntityRoutes(app, { db: dbHandle.db });
  }

  // ── Static SPA (production) ───────────────────────────────────────────────
  await registerStatic(app);

  return {
    app,
    dbHandle,
    close: async () => {
      await app.close();
      if (dbHandle) await dbHandle.close();
    },
  };
}
