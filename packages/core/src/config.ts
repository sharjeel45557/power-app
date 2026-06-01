import { randomBytes } from "node:crypto";
import type { Role } from "./types.js";

export type AuthMode = "entra" | "mock";

export interface OidcConfig {
  authority: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  postLogoutRedirectUri?: string;
  scopes: string[];
}

export interface GraphCredentials {
  tenantId: string;
  clientId: string;
  clientSecret: string;
}

export interface AppConfig {
  env: "development" | "production" | "test";
  isProduction: boolean;
  port: number;
  baseUrl: string;
  authMode: AuthMode;
  databaseUrl: string;
  sessionKeys: string[];
  oidc: OidcConfig;
  roleMappings: Record<string, Role>;
  defaultRole: Role;
  corsOrigins: string[];
  /** Microsoft Graph app-only credentials (for SharePoint etc.), if available. */
  graph: GraphCredentials | null;
  /** Register an in-memory demo connector (dev only by default). */
  connectorsDemo: boolean;
}

// ── VCAP_SERVICES helpers (Cloud Foundry) ────────────────────────────────────

interface VcapService {
  name?: string;
  label?: string;
  tags?: string[];
  credentials?: Record<string, unknown>;
}

function parseVcapServices(env: NodeJS.ProcessEnv): VcapService[] {
  const raw = env.VCAP_SERVICES;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Record<string, VcapService[]>;
    return Object.values(parsed).flat();
  } catch {
    return [];
  }
}

/** Finds a bound Postgres connection string from VCAP_SERVICES, if present. */
function databaseUrlFromVcap(services: VcapService[]): string | undefined {
  for (const svc of services) {
    const creds = svc.credentials ?? {};
    const candidate =
      (creds.uri as string | undefined) ??
      (creds.url as string | undefined) ??
      (creds.connectionString as string | undefined) ??
      (creds.jdbcUrl as string | undefined);
    if (typeof candidate === "string" && /^postgres/i.test(candidate)) {
      return candidate;
    }
    const isPg =
      /postgres/i.test(svc.label ?? "") ||
      (svc.tags ?? []).some((t) => /postgres/i.test(t));
    if (isPg && typeof candidate === "string") return candidate;
  }
  return undefined;
}

/**
 * Reads config from a user-provided service named `power-app-config` (so secrets
 * never live in the manifest). Its credentials are merged over process.env.
 */
function configServiceCredentials(
  services: VcapService[],
): Record<string, unknown> {
  const svc = services.find((s) => s.name === "power-app-config");
  return svc?.credentials ?? {};
}

// ── Parsing helpers ──────────────────────────────────────────────────────────

function asString(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

function parseJsonRecord(value: string | undefined): Record<string, string> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, string>;
    }
  } catch {
    /* ignore malformed mapping */
  }
  return {};
}

function csv(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Extracts the tenant id from an Entra v2.0 authority URL. */
function tenantFromAuthority(authority: string): string | undefined {
  const m = /login\.microsoftonline\.com\/([^/]+)/i.exec(authority);
  return m?.[1];
}

// ── Public loader ────────────────────────────────────────────────────────────

/**
 * Builds the typed application config from the environment, with Cloud Foundry
 * VCAP_SERVICES taken into account. Throws on missing required production values.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const services = parseVcapServices(env);
  const svcCreds = configServiceCredentials(services);

  const get = (key: string): string | undefined =>
    asString(env[key]) ?? asString(svcCreds[key]);

  const nodeEnv = (get("NODE_ENV") ?? "development") as AppConfig["env"];
  const isProduction = nodeEnv === "production";

  const port = Number(get("PORT") ?? "8080");
  const baseUrl = (get("BASE_URL") ?? `http://localhost:${port}`).replace(
    /\/$/,
    "",
  );

  const authMode: AuthMode = get("AUTH_MODE") === "entra" ? "entra" : "mock";

  const databaseUrl =
    get("DATABASE_URL") ?? databaseUrlFromVcap(services) ?? "";

  const sessionKeys = csv(get("SESSION_KEYS"));
  if (sessionKeys.length === 0) {
    if (isProduction) {
      throw new Error(
        "SESSION_KEYS is required in production (comma-separated base64 32-byte keys).",
      );
    }
    // Ephemeral dev key — sessions reset on restart.
    sessionKeys.push(randomBytes(32).toString("base64"));
  }

  const oidc: OidcConfig = {
    authority: get("OIDC_AUTHORITY") ?? "",
    clientId: get("OIDC_CLIENT_ID") ?? "",
    clientSecret: get("OIDC_CLIENT_SECRET") ?? "",
    redirectUri: get("OIDC_REDIRECT_URI") ?? `${baseUrl}/auth/callback`,
    postLogoutRedirectUri: get("OIDC_POST_LOGOUT_REDIRECT_URI") ?? baseUrl,
    scopes: csv(get("OIDC_SCOPES") ?? "openid profile email"),
  };

  if (authMode === "entra") {
    const missing = (
      ["authority", "clientId", "clientSecret"] as const
    ).filter((k) => !oidc[k]);
    if (missing.length > 0) {
      throw new Error(
        `AUTH_MODE=entra requires OIDC config. Missing: ${missing
          .map((m) => `OIDC_${m.replace(/([A-Z])/g, "_$1").toUpperCase()}`)
          .join(", ")}`,
      );
    }
  }

  const corsOrigins = csv(get("CORS_ORIGINS"));
  if (corsOrigins.length === 0) corsOrigins.push(baseUrl);

  // Microsoft Graph app-only credentials. Falls back to the OIDC app/tenant so
  // a single Entra registration (with application permissions added) can serve
  // both sign-in and Graph access.
  const graphTenant = get("GRAPH_TENANT_ID") ?? tenantFromAuthority(oidc.authority);
  const graphClientId = get("GRAPH_CLIENT_ID") ?? oidc.clientId;
  const graphClientSecret = get("GRAPH_CLIENT_SECRET") ?? oidc.clientSecret;
  const graph: GraphCredentials | null =
    graphTenant && graphClientId && graphClientSecret
      ? { tenantId: graphTenant, clientId: graphClientId, clientSecret: graphClientSecret }
      : null;

  const connectorsDemo =
    (get("CONNECTORS_DEMO") ?? (isProduction ? "false" : "true")) === "true";

  return {
    env: nodeEnv,
    isProduction,
    port,
    baseUrl,
    authMode,
    databaseUrl,
    sessionKeys,
    oidc,
    roleMappings: parseJsonRecord(get("ROLE_MAPPINGS")),
    defaultRole: get("DEFAULT_ROLE") ?? "viewer",
    corsOrigins,
    graph,
    connectorsDemo,
  };
}
