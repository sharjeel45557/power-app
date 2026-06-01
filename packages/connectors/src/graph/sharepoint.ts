import type { AccessRules, FieldMeta } from "@power-app/core";
import {
  type ConnectorContext,
  type ConnectorRecord,
  type ConnectorResource,
  type ListParams,
  type ListResult,
} from "../types.js";
import { graphRequest } from "./client.js";

/** A field, plus the SharePoint internal column name it maps to. */
export interface SharePointField extends FieldMeta {
  /** SharePoint list column internal name (e.g. "Title", "field_1"). */
  column: string;
}

export interface SharePointListConfig {
  name: string;
  label: string;
  labelSingular: string;
  /** Graph site id (host,siteCollectionId,webId) or "{hostname}:/sites/{path}:". */
  siteId: string;
  /** Graph list id (GUID) or list display name. */
  listId: string;
  fields: SharePointField[];
  access: AccessRules;
  /** When true, only list/read are exposed. */
  readOnly?: boolean;
}

interface GraphListItem {
  id: string;
  fields?: Record<string, unknown>;
}

/**
 * Builds a {@link ConnectorResource} backed by a SharePoint list via Microsoft
 * Graph. App-only auth means the app's service principal reads/writes the list
 * and power-app enforces its own RBAC — so end users get the data through the
 * app without needing direct SharePoint permissions.
 */
export function sharePointListResource(
  config: SharePointListConfig,
): ConnectorResource {
  const basePath = `/sites/${config.siteId}/lists/${config.listId}/items`;
  const uiFields: FieldMeta[] = config.fields.map(({ column: _column, ...f }) => f);

  const mapItem = (item: GraphListItem): ConnectorRecord => {
    const record: ConnectorRecord = { id: String(item.id) };
    for (const f of config.fields) {
      record[f.name] = item.fields?.[f.column] ?? null;
    }
    return record;
  };

  const toGraphFields = (
    values: Record<string, unknown>,
  ): Record<string, unknown> => {
    const out: Record<string, unknown> = {};
    for (const f of config.fields) {
      if (f.readOnly) continue;
      if (Object.prototype.hasOwnProperty.call(values, f.name)) {
        out[f.column] = values[f.name];
      }
    }
    return out;
  };

  const resource: ConnectorResource = {
    name: config.name,
    label: config.label,
    labelSingular: config.labelSingular,
    source: "SharePoint",
    fields: uiFields,
    access: config.access,

    async list(ctx: ConnectorContext, params: ListParams): Promise<ListResult> {
      // Graph list items page via @odata.nextLink rather than $skip; for the
      // foundation we fetch the first page sized to the request.
      const res = await graphRequest<{ value: GraphListItem[] }>(
        ctx,
        "GET",
        `${basePath}?expand=fields&$top=${params.pageSize}`,
      );
      return {
        data: (res.value ?? []).map(mapItem),
        total: null,
        page: params.page,
        pageSize: params.pageSize,
      };
    },

    async get(ctx, id) {
      const item = await graphRequest<GraphListItem>(
        ctx,
        "GET",
        `${basePath}/${id}?expand=fields`,
      );
      return item ? mapItem(item) : null;
    },
  };

  if (!config.readOnly) {
    resource.create = async (ctx, values) => {
      const item = await graphRequest<GraphListItem>(ctx, "POST", basePath, {
        fields: toGraphFields(values),
      });
      return mapItem(item);
    };
    resource.update = async (ctx, id, values) => {
      await graphRequest(ctx, "PATCH", `${basePath}/${id}/fields`, toGraphFields(values));
      const item = await graphRequest<GraphListItem>(
        ctx,
        "GET",
        `${basePath}/${id}?expand=fields`,
      );
      return mapItem(item);
    };
    resource.remove = async (ctx, id) => {
      await graphRequest(ctx, "DELETE", `${basePath}/${id}`);
    };
  }

  return resource;
}
