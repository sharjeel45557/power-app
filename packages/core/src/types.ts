// ── Identity & access ───────────────────────────────────────────────────────

/** An application role. Roles are derived from Entra ID group membership. */
export type Role = string;

/** The authenticated principal, normalised from Entra ID claims (or the mock). */
export interface User {
  /** Stable Entra object id (`oid`), or the mock id in dev. */
  id: string;
  email: string;
  name: string;
  /** Application roles, mapped from Entra groups via ROLE_MAPPINGS. */
  roles: Role[];
  /** Raw Entra group object-ids, retained for auditing/debugging. */
  groups?: string[];
}

/** CRUD actions an entity supports. */
export type Action = "list" | "read" | "create" | "update" | "delete";

/**
 * Access rule for a single action:
 *   - `"*"`             → any authenticated user
 *   - `Role[]`          → users holding at least one of these roles
 *   - `(user) => bool`  → custom predicate
 * An action with no rule is denied by default.
 */
export type AccessRule = "*" | Role[] | ((user: User) => boolean);

export type AccessRules = Partial<Record<Action, AccessRule>>;

// ── Field & entity metadata (UI-facing, serialisable) ────────────────────────

export type FieldType =
  | "text"
  | "textarea"
  | "email"
  | "number"
  | "boolean"
  | "date"
  | "datetime"
  | "select";

export interface FieldOption {
  label: string;
  value: string;
}

/** Drives auto-generated forms and data tables on the client. */
export interface FieldMeta {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  /** Options for `select` fields. */
  options?: FieldOption[];
  /** Show this column in the list/table view. */
  showInTable?: boolean;
  /** Helper text rendered under the input. */
  helpText?: string;
  /** System/derived field — shown but never editable. */
  readOnly?: boolean;
  placeholder?: string;
}

// ── Workflow (state machine for approvals / status transitions) ──────────────

export interface WorkflowState {
  /** Stored value, e.g. "in_review". */
  name: string;
  label: string;
}

export interface WorkflowTransition {
  /** Action id used by the API, e.g. "approve". */
  name: string;
  /** Button label, e.g. "Approve". */
  label: string;
  /** States this transition may fire from; "*" means any state. */
  from: string[] | "*";
  /** Resulting state. */
  to: string;
  /**
   * Who may perform it: "*" = any authenticated user, or a set of roles.
   * Independent of the entity's `update` access — an approver may transition
   * without being able to edit fields. Defaults to "*".
   */
  roles?: Role[] | "*";
  /** Require a note/justification to perform the transition. */
  requireNote?: boolean;
}

/** Declarative state machine bound to one field of an entity. */
export interface WorkflowDefinition {
  /** The field that holds the state (e.g. "status"). */
  field: string;
  /** State assigned on create. */
  initial: string;
  states: WorkflowState[];
  transitions: WorkflowTransition[];
}

/** Serialisable description of an entity, sent to the client to render UI. */
export interface EntityMeta {
  name: string;
  label: string;
  labelSingular: string;
  fields: FieldMeta[];
  defaultSort?: { field: string; dir: "asc" | "desc" };
  workflow?: WorkflowDefinition;
  /** What the *current* user may do — populated per-request by the server. */
  permissions?: Partial<Record<Action, boolean>>;
}
