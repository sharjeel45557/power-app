import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fastifyStatic from "@fastify/static";
import type { FastifyInstance } from "fastify";

/** Resolves the built web SPA directory (apps/web/dist) for dev and dist runs. */
function webDistDir(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  // dev:  apps/server/src → ../../web/dist
  // dist: apps/server/dist → ../../web/dist
  return path.resolve(here, "../../web/dist");
}

/**
 * Serves the pre-built React SPA and provides client-side-routing fallback.
 * In development the SPA is served by Vite, so this is effectively production-only.
 */
export async function registerStatic(app: FastifyInstance): Promise<void> {
  const root = webDistDir();
  if (!existsSync(root)) {
    app.log.warn(
      `Web build not found at ${root}; skipping static serving (run \`pnpm build\`).`,
    );
    return;
  }

  await app.register(fastifyStatic, { root, wildcard: false });

  // SPA fallback: anything that isn't an API/auth route serves index.html.
  app.setNotFoundHandler((req, reply) => {
    if (
      req.method === "GET" &&
      !req.url.startsWith("/api") &&
      !req.url.startsWith("/auth")
    ) {
      return reply.sendFile("index.html");
    }
    return reply.code(404).send({ error: "Not found." });
  });
}
