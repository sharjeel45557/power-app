import type { SourceMeta, User } from "@power-app/core/meta";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public issues?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    credentials: "include",
    headers:
      options.body !== undefined
        ? { "Content-Type": "application/json", ...options.headers }
        : options.headers,
    ...options,
  });

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const body = text ? (JSON.parse(text) as unknown) : null;

  if (!res.ok) {
    const payload = body as { error?: string; issues?: unknown } | null;
    throw new ApiError(payload?.error ?? res.statusText, res.status, payload?.issues);
  }
  return body as T;
}

export type RecordRow = Record<string, unknown> & { id: string };

/** A data-source kind, used as the API path segment too. */
export type SourceKind = "entities" | "connectors";

export interface ListResult {
  data: RecordRow[];
  page: number;
  pageSize: number;
  total: number | null;
}

export interface StatsResult {
  total: number;
  groupBy: string | null;
  buckets: { value: string; count: number }[];
}

export const api = {
  me: () => request<{ user: User }>("/auth/me"),

  logout: () => request<{ ok: boolean }>("/auth/logout", { method: "POST" }),

  // ── unified data sources (entities + connectors) ──────────────────────────
  sources: () => request<{ sources: SourceMeta[] }>("/api/meta/sources"),

  sourceMeta: (kind: SourceKind, name: string) =>
    request<{ entity: SourceMeta }>(`/api/meta/${kind}/${name}`),

  list: (kind: SourceKind, name: string, page = 1, pageSize = 25) =>
    request<ListResult>(`/api/${kind}/${name}?page=${page}&pageSize=${pageSize}`),

  get: (kind: SourceKind, name: string, id: string) =>
    request<{ data: RecordRow }>(`/api/${kind}/${name}/${id}`),

  create: (kind: SourceKind, name: string, values: Record<string, unknown>) =>
    request<{ data: RecordRow }>(`/api/${kind}/${name}`, {
      method: "POST",
      body: JSON.stringify(values),
    }),

  update: (
    kind: SourceKind,
    name: string,
    id: string,
    values: Record<string, unknown>,
  ) =>
    request<{ data: RecordRow }>(`/api/${kind}/${name}/${id}`, {
      method: "PATCH",
      body: JSON.stringify(values),
    }),

  remove: (kind: SourceKind, name: string, id: string) =>
    request<{ ok: boolean }>(`/api/${kind}/${name}/${id}`, { method: "DELETE" }),

  // ── entity-only features ──────────────────────────────────────────────────
  transition: (name: string, id: string, transition: string, note?: string) =>
    request<{ data: RecordRow }>(`/api/entities/${name}/${id}/transitions`, {
      method: "POST",
      body: JSON.stringify({ transition, note }),
    }),

  stats: (name: string, groupBy?: string) =>
    request<StatsResult>(
      `/api/entities/${name}/stats${groupBy ? `?groupBy=${groupBy}` : ""}`,
    ),
};

/** The route path prefix for a source kind. */
export function pathPrefix(kind: SourceKind): string {
  return kind === "entities" ? "/e" : "/c";
}

/** Triggers the server-side login redirect, preserving where to return to. */
export function startLogin(returnTo: string): void {
  window.location.href = `/auth/login?returnTo=${encodeURIComponent(returnTo)}`;
}
