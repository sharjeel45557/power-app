import type { User } from "@power-app/core";

/** Transient OIDC handshake state, held in the session between redirect legs. */
export interface OidcHandshake {
  state: string;
  nonce: string;
  codeVerifier: string;
  returnTo: string;
}

declare module "fastify" {
  interface FastifyRequest {
    /** The authenticated user for this request, or null. */
    user: User | null;
  }
}

declare module "@fastify/secure-session" {
  interface SessionData {
    user: User;
    oidc: OidcHandshake;
  }
}
