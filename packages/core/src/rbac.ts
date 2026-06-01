import type { Action, AccessRules, Role, User } from "./types.js";

const ALL_ACTIONS: Action[] = ["list", "read", "create", "update", "delete"];

/** Returns true if `user` is permitted to perform `action` under `access`. */
export function can(
  user: User | null | undefined,
  action: Action,
  access: AccessRules,
): boolean {
  if (!user) return false;
  const rule = access[action];
  if (rule === undefined) return false; // deny by default
  if (rule === "*") return true;
  if (typeof rule === "function") return rule(user);
  return rule.some((role) => user.roles.includes(role));
}

/** Computes the full permission map for a user against an entity's rules. */
export function permissionsFor(
  user: User | null | undefined,
  access: AccessRules,
): Record<Action, boolean> {
  const result = {} as Record<Action, boolean>;
  for (const action of ALL_ACTIONS) {
    result[action] = can(user, action, access);
  }
  return result;
}

/** Maps raw Entra group ids to application roles using a configured mapping. */
export function rolesFromGroups(
  groups: string[],
  roleMappings: Record<string, Role>,
  defaultRole: Role,
): Role[] {
  const roles = new Set<Role>();
  for (const group of groups) {
    const mapped = roleMappings[group];
    if (mapped) roles.add(mapped);
  }
  if (roles.size === 0) roles.add(defaultRole);
  return [...roles];
}

export function hasRole(user: User | null | undefined, role: Role): boolean {
  return !!user?.roles.includes(role);
}
