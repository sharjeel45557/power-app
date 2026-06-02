import openidClient from "openid-client";
import {
  rolesFromGroups,
  type AppConfig,
  type User,
} from "@power-app/core";

const { Issuer, generators } = openidClient;
type Client = openidClient.Client;

let clientPromise: Promise<Client> | null = null;

/** Discovers the Entra issuer and builds a cached OIDC client. */
export async function getOidcClient(config: AppConfig): Promise<Client> {
  if (!clientPromise) {
    clientPromise = (async () => {
      const issuer = await Issuer.discover(config.oidc.authority);
      return new issuer.Client({
        client_id: config.oidc.clientId,
        client_secret: config.oidc.clientSecret,
        redirect_uris: [config.oidc.redirectUri],
        response_types: ["code"],
      });
    })().catch((err) => {
      // Reset so a transient discovery failure can be retried on next login.
      clientPromise = null;
      throw err;
    });
  }
  return clientPromise;
}

export interface AuthRequestState {
  url: string;
  state: string;
  nonce: string;
  codeVerifier: string;
}

/** Builds the authorization-code + PKCE redirect URL and the checks to persist. */
export function buildAuthRequest(
  client: Client,
  config: AppConfig,
): AuthRequestState {
  const state = generators.state();
  const nonce = generators.nonce();
  const codeVerifier = generators.codeVerifier();
  const codeChallenge = generators.codeChallenge(codeVerifier);

  const url = client.authorizationUrl({
    scope: config.oidc.scopes.join(" "),
    state,
    nonce,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    redirect_uri: config.oidc.redirectUri,
  });

  return { url, state, nonce, codeVerifier };
}

/** Completes the callback and maps Entra claims to an application `User`. */
export async function completeAuth(
  client: Client,
  config: AppConfig,
  params: Record<string, string>,
  checks: { state: string; nonce: string; codeVerifier: string },
): Promise<User> {
  const tokenSet = await client.callback(config.oidc.redirectUri, params, {
    state: checks.state,
    nonce: checks.nonce,
    code_verifier: checks.codeVerifier,
  });

  const claims = tokenSet.claims();
  const groups = Array.isArray(claims.groups)
    ? (claims.groups as string[])
    : [];

  const email =
    (claims.email as string | undefined) ??
    (claims.preferred_username as string | undefined) ??
    (claims.upn as string | undefined) ??
    claims.sub;

  return {
    id: (claims.oid as string | undefined) ?? claims.sub,
    email,
    name: (claims.name as string | undefined) ?? email,
    groups,
    roles: rolesFromGroups(groups, config.roleMappings, config.defaultRole),
  };
}
