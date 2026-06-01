import type { AccessRules, FieldMeta } from "@power-app/core";
import {
  ConnectorError,
  type ConnectorContext,
  type ConnectorRecord,
  type ConnectorResource,
} from "../types.js";

export interface RestConnectorConfig {
  name: string;
  label: string;
  labelSingular: string;
  source?: string;
  /** Base URL, e.g. "https://api.example.com". */
  baseUrl: string;
  fields: FieldMeta[];
  access: AccessRules;
  /** Field on each item used as the id (default "id"). */
  idField?: string;
  /** Path (relative to baseUrl) for the collection (default ""). */
  listPath?: string;
  /** Builds the path for a single item (default `/${id}`). */
  itemPath?: (id: string) => string;
  /** Dot-path to the array within the list response (e.g. "data", "entry"). */
  dataPath?: string;
  /** Static headers (auth, accept, …). */
  headers?: Record<string, string>;
  /** Maps a raw item to a record (default: pass-through + id from idField). */
  mapItem?: (raw: unknown) => ConnectorRecord;
  readOnly?: boolean;
}

function getPath(value: unknown, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (acc, key) =>
        acc && typeof acc === "object"
          ? (acc as Record<string, unknown>)[key]
          : undefined,
      value,
    );
}

async function restRequest(
  ctx: ConnectorContext,
  method: string,
  url: string,
  headers: Record<string, string>,
  body?: unknown,
): Promise<unknown> {
  const res = await ctx.fetch(url, {
    method,
    headers: {
      Accept: "application/json",
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    ctx.log?.(`REST ${method} ${url} -> ${res.status}`);
    throw new ConnectorError(
      `REST ${method} ${url} failed (${res.status}).`,
      res.status === 404 ? 404 : 502,
    );
  }
  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

/** Builds a {@link ConnectorResource} backed by a generic REST/JSON API. */
export function restConnectorResource(
  config: RestConnectorConfig,
): ConnectorResource {
  const idField = config.idField ?? "id";
  const headers = config.headers ?? {};
  const listUrl = `${config.baseUrl}${config.listPath ?? ""}`;
  const itemUrl = (id: string) =>
    `${config.baseUrl}${config.itemPath ? config.itemPath(id) : `/${id}`}`;
  const mapItem =
    config.mapItem ??
    ((raw: unknown): ConnectorRecord => {
      const obj = (raw ?? {}) as Record<string, unknown>;
      return { ...obj, id: String(obj[idField]) };
    });

  const resource: ConnectorResource = {
    name: config.name,
    label: config.label,
    labelSingular: config.labelSingular,
    source: config.source ?? "REST",
    fields: config.fields,
    access: config.access,

    async list(ctx, params) {
      const json = await restRequest(ctx, "GET", listUrl, headers);
      const raw = config.dataPath ? getPath(json, config.dataPath) : json;
      const items = Array.isArray(raw) ? raw : [];
      return {
        data: items.map(mapItem),
        total: items.length,
        page: params.page,
        pageSize: params.pageSize,
      };
    },

    async get(ctx, id) {
      const json = await restRequest(ctx, "GET", itemUrl(id), headers);
      return json ? mapItem(json) : null;
    },
  };

  if (!config.readOnly) {
    resource.create = async (ctx, values) => {
      const json = await restRequest(ctx, "POST", listUrl, headers, values);
      return mapItem(json ?? values);
    };
    resource.update = async (ctx, id, values) => {
      const json = await restRequest(ctx, "PATCH", itemUrl(id), headers, values);
      return mapItem(json ?? { ...values, [idField]: id });
    };
    resource.remove = async (ctx, id) => {
      await restRequest(ctx, "DELETE", itemUrl(id), headers);
    };
  }

  return resource;
}

export interface FhirResourceConfig {
  name: string;
  label: string;
  labelSingular: string;
  baseUrl: string;
  /** FHIR resource type, e.g. "Patient", "Observation". */
  resourceType: string;
  fields: FieldMeta[];
  access: AccessRules;
  headers?: Record<string, string>;
}

/**
 * Read-only connector for a FHIR endpoint. Lists `Bundle.entry[].resource` and
 * reads a resource by id, projecting top-level fields. For nested FHIR paths,
 * build a {@link restConnectorResource} with a custom `mapItem`.
 */
export function fhirResource(config: FhirResourceConfig): ConnectorResource {
  const mapItem = (raw: unknown): ConnectorRecord => {
    const entry = raw as { resource?: Record<string, unknown> };
    const resource = entry.resource ?? (raw as Record<string, unknown>);
    const record: ConnectorRecord = { id: String(resource.id) };
    for (const f of config.fields) {
      if (f.name !== "id") record[f.name] = resource[f.name] ?? null;
    }
    return record;
  };

  return restConnectorResource({
    name: config.name,
    label: config.label,
    labelSingular: config.labelSingular,
    source: "FHIR",
    baseUrl: config.baseUrl,
    fields: config.fields,
    access: config.access,
    listPath: `/${config.resourceType}`,
    itemPath: (id) => `/${config.resourceType}/${id}`,
    dataPath: "entry",
    mapItem,
    readOnly: true,
    headers: { Accept: "application/fhir+json", ...config.headers },
  });
}
