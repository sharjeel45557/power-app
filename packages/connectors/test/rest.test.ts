import { test } from "node:test";
import assert from "node:assert/strict";
import { fhirResource, restConnectorResource, type ConnectorContext } from "../src/index.js";

test("REST: dataPath, idField mapping for list/get/create", async () => {
  const fetchImpl = (async (url: string, init: { method: string }) => {
    if (init.method === "GET" && String(url).endsWith("/things")) {
      return { ok: true, status: 200, text: async () => JSON.stringify({ data: [{ ref: "1", n: "a" }, { ref: "2", n: "b" }] }) };
    }
    if (init.method === "GET") {
      return { ok: true, status: 200, text: async () => JSON.stringify({ ref: "1", n: "a" }) };
    }
    if (init.method === "POST") {
      return { ok: true, status: 201, text: async () => JSON.stringify({ ref: "9", n: "z" }) };
    }
    return { ok: false, status: 404, text: async () => "" };
  }) as unknown as typeof fetch;

  const ctx: ConnectorContext = { user: null, fetch: fetchImpl, getAppToken: async () => "" };
  const r = restConnectorResource({
    name: "things",
    label: "",
    labelSingular: "",
    baseUrl: "https://api.x",
    listPath: "/things",
    itemPath: (id) => `/things/${id}`,
    dataPath: "data",
    idField: "ref",
    fields: [],
    access: { list: "*", read: "*", create: ["admin"] },
  });

  const listed = await r.list(ctx, { page: 1, pageSize: 10 });
  assert.equal(listed.data.length, 2);
  assert.equal(listed.data[0]!.id, "1");

  const got = await r.get!(ctx, "1");
  assert.equal(got?.id, "1");

  const created = await r.create!(ctx, { n: "z" });
  assert.equal(created.id, "9");
});

test("FHIR: maps Bundle.entry[].resource and is read-only", async () => {
  const fetchImpl = (async (url: string) => {
    if (String(url).includes("/Patient")) {
      return {
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({ entry: [{ resource: { id: "p1", name: "X" } }, { resource: { id: "p2", name: "Y" } }] }),
      };
    }
    return { ok: false, status: 404, text: async () => "" };
  }) as unknown as typeof fetch;

  const ctx: ConnectorContext = { user: null, fetch: fetchImpl, getAppToken: async () => "" };
  const r = fhirResource({
    name: "patients",
    label: "",
    labelSingular: "",
    baseUrl: "https://fhir.x",
    resourceType: "Patient",
    fields: [{ name: "name", label: "Name", type: "text" }],
    access: { list: "*" },
  });

  const listed = await r.list(ctx, { page: 1, pageSize: 10 });
  assert.equal(listed.data.length, 2);
  assert.equal(listed.data[0]!.id, "p1");
  assert.equal(listed.data[0]!.name, "X");
  assert.equal(typeof r.create, "undefined");
});
