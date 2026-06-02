import type { FastifyInstance } from "fastify";
import type { AppConfig } from "@power-app/core";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function normalizeOrigin(value: string): string {
  return value.replace(/\/$/, "");
}

/**
 * CSRF defence for a cookie-authenticated API: reject mutating requests whose
 * `Origin` doesn't match an allowed origin. Combined with the session cookie's
 * `SameSite=Lax` + `HttpOnly` flags and the JSON content type (which forces a
 * CORS preflight cross-origin), this blocks classic CSRF.
 *
 * A missing `Origin` is allowed: same-origin requests may omit it, and such
 * requests are still covered by SameSite. Browsers send `Origin` on all
 * cross-origin (and non-GET same-origin) requests, which is what we gate on.
 */
export function isAllowedOrigin(
  origin: string | undefined,
  allowed: ReadonlySet<string>,
): boolean {
  if (!origin) return true;
  return allowed.has(normalizeOrigin(origin));
}

export function registerCsrfGuard(
  app: FastifyInstance,
  config: AppConfig,
): void {
  const allowed = new Set<string>(
    [config.baseUrl, ...config.corsOrigins].map(normalizeOrigin),
  );

  app.addHook("onRequest", async (req, reply) => {
    if (!MUTATING_METHODS.has(req.method)) return;
    if (!isAllowedOrigin(req.headers.origin, allowed)) {
      return reply.code(403).send({ error: "Cross-origin request blocked." });
    }
  });
}

/** helmet's Content-Security-Policy options. The SPA loads only external,
 * same-origin hashed assets, so script-src can stay strict ('self'). */
export const contentSecurityPolicy = {
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],
    // External stylesheet is same-origin; 'unsafe-inline' covers React inline
    // style attributes without weakening script-src.
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", "data:"],
    connectSrc: ["'self'"],
    fontSrc: ["'self'", "data:"],
    objectSrc: ["'none'"],
    frameAncestors: ["'self'"],
    baseUri: ["'self'"],
    formAction: ["'self'"],
  },
};
