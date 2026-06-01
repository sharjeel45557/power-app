import { ConnectorError, type ConnectorContext } from "../types.js";
import { GRAPH_DEFAULT_SCOPE } from "./token.js";

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

/**
 * Issues an authenticated Microsoft Graph request. Returns parsed JSON, or null
 * for empty (204) responses. Throws a {@link ConnectorError} on failure.
 */
export async function graphRequest<T = unknown>(
  ctx: ConnectorContext,
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const token = await ctx.getAppToken(GRAPH_DEFAULT_SCOPE);
  const res = await ctx.fetch(`${GRAPH_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    ctx.log?.(`Graph ${method} ${path} -> ${res.status}`, text);
    throw new ConnectorError(
      `Graph ${method} ${path} failed (${res.status}).`,
      res.status === 404 ? 404 : 502,
    );
  }

  if (res.status === 204) return null as T;
  return (await res.json()) as T;
}
