import { test } from "node:test";
import assert from "node:assert/strict";
import { sharePointListResource, type ConnectorContext } from "../src/index.js";

test("SharePoint list: maps columns, paths, and create body", async () => {
  const calls: { url: string; method: string; body?: string }[] = [];
  const fetchImpl = (async (url: string, init: { method: string; body?: string; headers: Record<string, string> }) => {
    calls.push({ url: String(url), method: init.method, body: init.body });
    assert.equal(init.headers.Authorization, "Bearer tok");
    if (init.method === "GET" && String(url).includes("/items?expand=fields")) {
      return { ok: true, status: 200, json: async () => ({ value: [{ id: "10", fields: { Title: "A", Vendor: "Acme" } }] }) };
    }
    if (init.method === "POST") {
      return { ok: true, status: 201, json: async () => ({ id: "12", fields: { Title: "C", Vendor: "Init" } }) };
    }
    return { ok: false, status: 404, text: async () => "nf" };
  }) as unknown as typeof fetch;

  const ctx: ConnectorContext = { user: null, fetch: fetchImpl, getAppToken: async () => "tok" };

  const sp = sharePointListResource({
    name: "equipment",
    label: "Equipment",
    labelSingular: "Equipment",
    siteId: "SITE",
    listId: "LIST",
    access: { list: "*", read: "*", create: ["admin"] },
    fields: [
      { name: "name", label: "Name", type: "text", column: "Title" },
      { name: "vendor", label: "Vendor", type: "text", column: "Vendor" },
    ],
  });

  const listed = await sp.list(ctx, { page: 1, pageSize: 25 });
  assert.equal(listed.data.length, 1);
  assert.equal(listed.data[0]!.name, "A");
  assert.equal(listed.data[0]!.vendor, "Acme");
  assert.ok(calls[0]!.url.includes("/sites/SITE/lists/LIST/items"));

  const created = await sp.create!(ctx, { name: "C", vendor: "Init" });
  assert.equal(created.id, "12");
  assert.equal(created.name, "C");
  const postBody = JSON.parse(calls.find((c) => c.method === "POST")!.body!);
  assert.equal(postBody.fields.Title, "C");
  assert.equal(postBody.fields.Vendor, "Init");
});

test("SharePoint readOnly exposes no write methods", () => {
  const sp = sharePointListResource({
    name: "ro",
    label: "",
    labelSingular: "",
    siteId: "S",
    listId: "L",
    access: { list: "*" },
    fields: [],
    readOnly: true,
  });
  assert.equal(typeof sp.create, "undefined");
  assert.equal(typeof sp.update, "undefined");
  assert.equal(typeof sp.remove, "undefined");
});
