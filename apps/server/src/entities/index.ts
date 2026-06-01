import type { EntityDefinition } from "@power-app/core";
import { requestsEntity } from "./requests.js";
// @power-app/cli:imports — `paf new entity` inserts entity imports above this line.

/**
 * The entity registry. Register new entities here and they are immediately
 * exposed via the generic REST API, metadata endpoint, and client UI.
 * (`paf new entity` updates this automatically.)
 */
export const entities: EntityDefinition[] = [
  requestsEntity,
  // @power-app/cli:register — `paf new entity` inserts entities above this line.
];

export function getEntity(name: string): EntityDefinition | null {
  return entities.find((e) => e.name === name) ?? null;
}
