import type { ConnectorResource } from "./types.js";

/** Holds the connector resources exposed by the app. */
export class ConnectorRegistry {
  private readonly resources = new Map<string, ConnectorResource>();

  register(resource: ConnectorResource): void {
    if (this.resources.has(resource.name)) {
      throw new Error(`Connector resource "${resource.name}" already registered.`);
    }
    this.resources.set(resource.name, resource);
  }

  get(name: string): ConnectorResource | null {
    return this.resources.get(name) ?? null;
  }

  list(): ConnectorResource[] {
    return [...this.resources.values()];
  }

  get size(): number {
    return this.resources.size;
  }
}
