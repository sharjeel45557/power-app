import type { PgTable } from "drizzle-orm/pg-core";
import type { ZodTypeAny } from "zod";
import type {
  AccessRules,
  EntityMeta,
  FieldMeta,
  WorkflowDefinition,
} from "./types.js";

/**
 * The full server-side definition of an entity. Pairs the UI metadata with the
 * Drizzle table it persists to and the Zod schemas that validate writes.
 *
 * Declaring one entity gives you, for free:
 *   - a typed REST API (list/read/create/update/delete)
 *   - server-side validation
 *   - an auto-generated form and data table on the client
 *   - role-based access enforcement + audit logging
 */
export interface EntityDefinition<TTable extends PgTable = PgTable> {
  /** URL-safe identifier, e.g. `"requests"`. Used in API paths. */
  name: string;
  /** Plural display label, e.g. `"Service Requests"`. */
  label: string;
  /** Singular display label, e.g. `"Service Request"`. */
  labelSingular: string;
  /** The Drizzle table this entity reads from and writes to. */
  table: TTable;
  /** Validates the create payload. */
  createSchema: ZodTypeAny;
  /** Validates the update payload (typically a partial of create). */
  updateSchema: ZodTypeAny;
  /** UI metadata describing each editable/visible field. */
  fields: FieldMeta[];
  /** Role-based access rules per action. */
  access: AccessRules;
  /** Default ordering applied to list queries. */
  defaultSort?: { field: string; dir: "asc" | "desc" };
  /** Optional state machine driving a status field (approvals, etc.). */
  workflow?: WorkflowDefinition;
}

/** Identity helper that preserves the table's type for downstream inference. */
export function defineEntity<TTable extends PgTable>(
  def: EntityDefinition<TTable>,
): EntityDefinition<TTable> {
  return def;
}

/** Projects an entity definition to its serialisable, client-safe metadata. */
export function toEntityMeta(def: EntityDefinition): EntityMeta {
  return {
    name: def.name,
    label: def.label,
    labelSingular: def.labelSingular,
    fields: def.fields,
    defaultSort: def.defaultSort,
    workflow: def.workflow,
  };
}
