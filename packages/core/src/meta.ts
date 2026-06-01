// Browser-safe entry point: pure types + RBAC helpers only. Importing this from
// the web app keeps server-only dependencies (drizzle, postgres) out of the
// client bundle.
export * from "./types.js";
export { can, permissionsFor, hasRole, rolesFromGroups } from "./rbac.js";
