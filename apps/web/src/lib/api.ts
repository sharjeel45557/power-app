import type { EntityMeta, User } from "@power-app/core/meta";

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

export interface ListResult {
  data: RecordRow[];
  page: number;
  pageSize: number;
  total: number;
}

export const api = {
  me: () => request<{ user: User }>("/auth/me"),

  logout: () => request<{ ok: boolean }>("/auth/logout", { method: "POST" }),

  entitiesMeta: () => request<{ entities: EntityMeta[] }>("/api/meta/entities"),

  entityMeta: (name: string) =>
    request<{ entity: EntityMeta }>(`/api/meta/entities/${name}`),

  list: (name: string, page = 1, pageSize = 25) =>
    request<ListResult>(
      `/api/entities/${name}?page=${page}&pageSize=${pageSize}`,
    ),

  get: (name: string, id: string) =>
    request<{ data: RecordRow }>(`/api/entities/${name}/${id}`),

  create: (name: string, values: Record<string, unknown>) =>
    request<{ data: RecordRow }>(`/api/entities/${name}`, {
      method: "POST",
      body: JSON.stringify(values),
    }),

  update: (name: string, id: string, values: Record<string, unknown>) =>
    request<{ data: RecordRow }>(`/api/entities/${name}/${id}`, {
      method: "PATCH",
      body: JSON.stringify(values),
    }),

  remove: (name: string, id: string) =>
    request<{ ok: boolean }>(`/api/entities/${name}/${id}`, {
      method: "DELETE",
    }),
};

/** Triggers the server-side login redirect, preserving where to return to. */
export function startLogin(returnTo: string): void {
  window.location.href = `/auth/login?returnTo=${encodeURIComponent(returnTo)}`;
}
