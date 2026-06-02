import {
  ConnectorRegistry,
  createGraphTokenProvider,
  sharePointListResource,
  type ConnectorContext,
  type SharePointListConfig,
} from "@power-app/connectors";
import type { AppConfig, User } from "@power-app/core";
import { demoConnector } from "./demo.js";

export interface ConnectorRuntime {
  registry: ConnectorRegistry;
  makeContext: (user: User | null) => ConnectorContext;
}

/** Parses SHAREPOINT_LISTS env (JSON array of list configs). */
function parseSharePointLists(): SharePointListConfig[] {
  const raw = process.env.SHAREPOINT_LISTS;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as SharePointListConfig[]) : [];
  } catch {
    return [];
  }
}

/**
 * Builds the connector registry from configuration:
 *   - SharePoint lists declared in SHAREPOINT_LISTS (when Graph is configured),
 *   - a demo in-memory connector when CONNECTORS_DEMO is on.
 * Also provides a per-request context factory carrying the Graph token provider.
 */
export function setupConnectors(
  config: AppConfig,
  log: (msg: string) => void = () => {},
): ConnectorRuntime {
  const registry = new ConnectorRegistry();

  const tokenProvider = config.graph
    ? createGraphTokenProvider(config.graph)
    : async (): Promise<string> => {
        throw new Error("Microsoft Graph is not configured (set GRAPH_* env).");
      };

  if (config.graph) {
    for (const listConfig of parseSharePointLists()) {
      try {
        registry.register(sharePointListResource(listConfig));
        log(`registered SharePoint list "${listConfig.name}"`);
      } catch (err) {
        log(`failed to register SharePoint list: ${String(err)}`);
      }
    }
  }

  if (config.connectorsDemo) {
    registry.register(demoConnector());
    log("registered demo connector \"vendor_contacts\"");
  }

  const makeContext = (user: User | null): ConnectorContext => ({
    user,
    fetch,
    getAppToken: tokenProvider,
    log: (msg) => log(`[connector] ${msg}`),
  });

  return { registry, makeContext };
}
