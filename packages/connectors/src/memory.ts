import type { AccessRules, FieldMeta } from "@power-app/core";
import {
  ConnectorError,
  type ConnectorRecord,
  type ConnectorResource,
} from "./types.js";

export interface InMemoryConfig {
  name: string;
  label: string;
  labelSingular: string;
  source?: string;
  fields: FieldMeta[];
  access: AccessRules;
  seed?: Record<string, unknown>[];
  readOnly?: boolean;
}

/**
 * An in-memory connector resource. Used as a dev/demo source (so the connector
 * pipeline is exercisable without external systems) and in tests. State is
 * per-process and resets on restart.
 */
export function inMemoryResource(config: InMemoryConfig): ConnectorResource {
  const store = new Map<string, ConnectorRecord>();
  let seq = 0;

  for (const row of config.seed ?? []) {
    const id = String(row.id ?? ++seq);
    store.set(id, { ...row, id });
  }

  const resource: ConnectorResource = {
    name: config.name,
    label: config.label,
    labelSingular: config.labelSingular,
    source: config.source ?? "In-memory",
    fields: config.fields,
    access: config.access,

    async list(_ctx, params) {
      const all = [...store.values()];
      const start = (params.page - 1) * params.pageSize;
      return {
        data: all.slice(start, start + params.pageSize),
        total: all.length,
        page: params.page,
        pageSize: params.pageSize,
      };
    },

    async get(_ctx, id) {
      return store.get(id) ?? null;
    },
  };

  if (!config.readOnly) {
    resource.create = async (ctx, values) => {
      const id = String(++seq);
      const record: ConnectorRecord = {
        ...values,
        id,
        ...(config.fields.some((f) => f.name === "createdBy")
          ? { createdBy: ctx.user?.email ?? null }
          : {}),
      };
      store.set(id, record);
      return record;
    };
    resource.update = async (_ctx, id, values) => {
      const current = store.get(id);
      if (!current) throw new ConnectorError("Not found.", 404);
      const record: ConnectorRecord = { ...current, ...values, id };
      store.set(id, record);
      return record;
    };
    resource.remove = async (_ctx, id) => {
      if (!store.delete(id)) throw new ConnectorError("Not found.", 404);
    };
  }

  return resource;
}
