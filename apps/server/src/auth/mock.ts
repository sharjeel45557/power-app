import { rolesFromGroups, type AppConfig, type User } from "@power-app/core";

/**
 * Local-dev stand-in for Entra ID. Returns a deterministic user so the whole
 * app can be exercised before IT registers the App Registration. Never enabled
 * in production (AUTH_MODE must be "entra" there).
 */
export function mockUser(
  config: AppConfig,
  overrides: Partial<User> = {},
): User {
  const email = overrides.email ?? "dev.user@example.com";
  // Pretend this user is in every mapped group, so all roles are exercised in
  // dev. If no mappings are configured, they get an admin + the default role.
  const groups = overrides.groups ?? Object.keys(config.roleMappings);
  const mapped = rolesFromGroups(groups, config.roleMappings, config.defaultRole);
  const roles = overrides.roles ?? (groups.length > 0 ? mapped : ["admin", config.defaultRole]);

  return {
    id: overrides.id ?? "mock-user-1",
    email,
    name: overrides.name ?? "Dev User",
    groups,
    roles,
  };
}
