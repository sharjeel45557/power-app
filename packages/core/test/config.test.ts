import { test } from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "../src/index.js";

test("dev defaults: mock auth, ephemeral session key, demo connectors", () => {
  const c = loadConfig({ NODE_ENV: "development", AUTH_MODE: "mock" });
  assert.equal(c.authMode, "mock");
  assert.equal(c.isProduction, false);
  assert.ok(c.sessionKeys.length >= 1);
  assert.equal(c.defaultRole, "viewer");
  assert.equal(c.connectorsDemo, true);
});

test("parses ROLE_MAPPINGS and CORS_ORIGINS", () => {
  const c = loadConfig({ ROLE_MAPPINGS: '{"g1":"admin"}', CORS_ORIGINS: "http://a, http://b" });
  assert.deepEqual(c.roleMappings, { g1: "admin" });
  assert.deepEqual(c.corsOrigins, ["http://a", "http://b"]);
});

test("graph credentials fall back to OIDC tenant/client", () => {
  const c = loadConfig({
    OIDC_AUTHORITY: "https://login.microsoftonline.com/TENANT/v2.0",
    OIDC_CLIENT_ID: "cid",
    OIDC_CLIENT_SECRET: "sec",
  });
  assert.equal(c.graph?.tenantId, "TENANT");
  assert.equal(c.graph?.clientId, "cid");
  assert.equal(c.graph?.clientSecret, "sec");
});

test("AUTH_MODE=entra without OIDC config throws", () => {
  assert.throws(() => loadConfig({ AUTH_MODE: "entra" }));
});

test("reads DATABASE_URL from VCAP_SERVICES", () => {
  const vcap = JSON.stringify({
    postgres: [{ name: "x", credentials: { uri: "postgres://u:p@h:5432/db" } }],
  });
  const c = loadConfig({ VCAP_SERVICES: vcap });
  assert.equal(c.databaseUrl, "postgres://u:p@h:5432/db");
});

test("production requires SESSION_KEYS", () => {
  assert.throws(() => loadConfig({ NODE_ENV: "production", AUTH_MODE: "mock" }));
});

test("production connectorsDemo defaults off", () => {
  const c = loadConfig({
    NODE_ENV: "production",
    AUTH_MODE: "mock",
    SESSION_KEYS: Buffer.alloc(32, 1).toString("base64"),
  });
  assert.equal(c.connectorsDemo, false);
});
