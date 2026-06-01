import { test } from "node:test";
import assert from "node:assert/strict";
import { createGraphTokenProvider } from "../src/index.js";

test("token: client-credentials request and caching", async () => {
  let calls = 0;
  const fetchImpl = (async (url: string, init: { body: URLSearchParams }) => {
    calls++;
    assert.ok(String(url).includes("/oauth2/v2.0/token"));
    assert.ok(init.body.toString().includes("grant_type=client_credentials"));
    return { ok: true, status: 200, json: async () => ({ access_token: "T", expires_in: 3600 }) };
  }) as unknown as typeof fetch;

  const provider = createGraphTokenProvider({ tenantId: "t", clientId: "c", clientSecret: "s" }, fetchImpl);
  assert.equal(await provider(), "T");
  await provider();
  assert.equal(calls, 1, "second call served from cache");
});

test("token: throws on failure response", async () => {
  const fetchImpl = (async () => ({ ok: false, status: 401, text: async () => "bad" })) as unknown as typeof fetch;
  const provider = createGraphTokenProvider({ tenantId: "t", clientId: "c", clientSecret: "s" }, fetchImpl);
  await assert.rejects(() => provider(), /token request failed/);
});
