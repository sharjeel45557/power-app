import type { GraphCredentials } from "@power-app/core";
import { ConnectorError } from "../types.js";

export const GRAPH_DEFAULT_SCOPE = "https://graph.microsoft.com/.default";

interface CachedToken {
  token: string;
  /** epoch ms when the token expires */
  expiresAt: number;
}

/**
 * Returns an app-only (client-credentials) token provider for Microsoft Graph,
 * caching tokens per scope until shortly before expiry. `fetchImpl` is
 * injectable for testing.
 */
export function createGraphTokenProvider(
  creds: GraphCredentials,
  fetchImpl: typeof fetch = fetch,
): (scope?: string) => Promise<string> {
  const cache = new Map<string, CachedToken>();
  const url = `https://login.microsoftonline.com/${creds.tenantId}/oauth2/v2.0/token`;

  return async (scope = GRAPH_DEFAULT_SCOPE): Promise<string> => {
    const now = Date.now();
    const hit = cache.get(scope);
    if (hit && hit.expiresAt > now + 60_000) return hit.token;

    const res = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
        scope,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new ConnectorError(
        `Graph token request failed (${res.status}): ${text}`,
        502,
      );
    }

    const json = (await res.json()) as {
      access_token: string;
      expires_in: number;
    };
    cache.set(scope, {
      token: json.access_token,
      expiresAt: now + json.expires_in * 1000,
    });
    return json.access_token;
  };
}
