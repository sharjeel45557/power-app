import secureSession from "@fastify/secure-session";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { AppConfig } from "@power-app/core";
import type { Db } from "../db/client.js";
import { writeAudit } from "../audit.js";
import { buildAuthRequest, completeAuth, getOidcClient } from "./oidc.js";
import { mockUser } from "./mock.js";

export interface AuthDeps {
  config: AppConfig;
  db: Db | null;
}

/** Validates and decodes the configured base64 session keys (32 bytes each). */
function sessionKeyBuffers(keys: string[]): Buffer[] {
  const buffers = keys.map((k) => Buffer.from(k, "base64"));
  for (const buf of buffers) {
    if (buf.length !== 32) {
      throw new Error(
        "Each SESSION_KEYS entry must be a base64-encoded 32-byte key.",
      );
    }
  }
  return buffers;
}

/** Returns a safe, same-origin return path (prevents open-redirects). */
function safeReturnTo(value: unknown): string {
  if (typeof value === "string" && value.startsWith("/") && !value.startsWith("//")) {
    return value;
  }
  return "/";
}

export async function registerAuth(
  app: FastifyInstance,
  { config, db }: AuthDeps,
): Promise<void> {
  await app.register(secureSession, {
    key: sessionKeyBuffers(config.sessionKeys),
    cookieName: "power_app_session",
    cookie: {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: config.isProduction,
      maxAge: 60 * 60 * 8, // 8 hours
    },
  });

  app.decorateRequest("user", null);

  // Hydrate request.user from the session on every request.
  app.addHook("onRequest", async (req) => {
    req.user = req.session.get("user") ?? null;
  });

  const clearOidc = (req: FastifyRequest) =>
    req.session.set("oidc", undefined as unknown as never);

  // ── GET /auth/login ────────────────────────────────────────────────────────
  app.get<{ Querystring: { returnTo?: string } }>(
    "/auth/login",
    async (req, reply) => {
      const returnTo = safeReturnTo(req.query.returnTo);

      if (config.authMode === "mock") {
        const user = mockUser(config);
        req.session.set("user", user);
        if (db) await writeAudit(db, user, { action: "login", entity: "auth", summary: "mock login" });
        return reply.redirect(returnTo);
      }

      const client = await getOidcClient(config);
      const authReq = buildAuthRequest(client, config);
      req.session.set("oidc", {
        state: authReq.state,
        nonce: authReq.nonce,
        codeVerifier: authReq.codeVerifier,
        returnTo,
      });
      return reply.redirect(authReq.url);
    },
  );

  // ── GET /auth/callback ───────────────────────────────────────────────────────
  app.get<{ Querystring: Record<string, string> }>(
    "/auth/callback",
    async (req, reply) => {
      if (config.authMode === "mock") {
        return reply.redirect("/");
      }

      const handshake = req.session.get("oidc");
      if (!handshake) {
        return reply.code(400).send({ error: "No login in progress." });
      }
      clearOidc(req);

      try {
        const client = await getOidcClient(config);
        const user = await completeAuth(client, config, req.query, {
          state: handshake.state,
          nonce: handshake.nonce,
          codeVerifier: handshake.codeVerifier,
        });
        req.session.set("user", user);
        if (db) await writeAudit(db, user, { action: "login", entity: "auth" });
        return reply.redirect(safeReturnTo(handshake.returnTo));
      } catch (err) {
        req.log.error({ err }, "OIDC callback failed");
        return reply.code(401).send({ error: "Authentication failed." });
      }
    },
  );

  // ── POST /auth/logout ────────────────────────────────────────────────────────
  app.post("/auth/logout", async (req, reply) => {
    const user = req.user;
    req.session.delete();
    if (db && user) await writeAudit(db, user, { action: "logout", entity: "auth" });
    return reply.send({ ok: true });
  });

  // ── GET /auth/me ──────────────────────────────────────────────────────────────
  app.get("/auth/me", async (req, reply) => {
    if (!req.user) return reply.code(401).send({ error: "Not authenticated." });
    return reply.send({ user: req.user });
  });
}

/**
 * preHandler that rejects unauthenticated requests. Returning the sent reply
 * halts Fastify's request lifecycle so the route handler never runs.
 */
export async function requireAuth(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<FastifyReply | undefined> {
  if (!req.user) {
    return reply.code(401).send({ error: "Not authenticated." });
  }
  return undefined;
}
