import type { AccessRules, Action, FieldMeta, User } from "@power-app/core";

/** A record returned by a connector. Always has a string `id`. */
export type ConnectorRecord = Record<string, unknown> & { id: string };

export interface ListParams {
  page: number;
  pageSize: number;
}

export interface ListResult {
  data: ConnectorRecord[];
  /** Total count if the source can provide it cheaply; otherwise null. */
  total: number | null;
  page: number;
  pageSize: number;
}

/**
 * Per-request context handed to connector operations. `fetch` and the token
 * provider are injected so connectors are easy to test with stubs and never
 * reach for globals directly.
 */
export interface ConnectorContext {
  user: User | null;
  fetch: typeof fetch;
  /** Acquires an app-only access token for the given scope (e.g. Graph). */
  getAppToken: (scope: string) => Promise<string>;
  log?: (msg: string, meta?: unknown) => void;
}

/**
 * A connector resource behaves like an entity but is backed by an external
 * system. `list` is required; the presence of the other methods declares which
 * operations the resource supports (see {@link resourceCapabilities}).
 */
export interface ConnectorResource {
  name: string;
  label: string;
  labelSingular: string;
  /** Backing system label shown in the UI, e.g. "SharePoint". */
  source: string;
  fields: FieldMeta[];
  access: AccessRules;
  list(ctx: ConnectorContext, params: ListParams): Promise<ListResult>;
  get?(ctx: ConnectorContext, id: string): Promise<ConnectorRecord | null>;
  create?(
    ctx: ConnectorContext,
    values: Record<string, unknown>,
  ): Promise<ConnectorRecord>;
  update?(
    ctx: ConnectorContext,
    id: string,
    values: Record<string, unknown>,
  ): Promise<ConnectorRecord>;
  remove?(ctx: ConnectorContext, id: string): Promise<void>;
}

/** Which CRUD actions a resource supports, derived from its defined methods. */
export function resourceCapabilities(
  resource: ConnectorResource,
): Record<Action, boolean> {
  return {
    list: typeof resource.list === "function",
    read: typeof resource.get === "function",
    create: typeof resource.create === "function",
    update: typeof resource.update === "function",
    delete: typeof resource.remove === "function",
  };
}

/** Error carrying an HTTP-ish status so routes can map failures sensibly. */
export class ConnectorError extends Error {
  constructor(
    message: string,
    public status = 502,
  ) {
    super(message);
    this.name = "ConnectorError";
  }
}
