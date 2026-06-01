import type { EntityDefinition } from "@power-app/core";
import { requestsEntity } from "./requests.js";

/**
 * The entity registry. Register new entities here and they are immediately
 * exposed via the generic REST API, metadata endpoint, and client UI.
 */
export const entities: EntityDefinition[] = [requestsEntity];

export function getEntity(name: string): EntityDefinition | null {
  return entities.find((e) => e.name === name) ?? null;
}
