import { test } from "node:test";
import assert from "node:assert/strict";
import { inMemoryResource, type ConnectorContext } from "../src/index.js";

const ctx: ConnectorContext = {
  user: { id: "1", email: "u@x", name: "U", roles: ["admin"] },
  fetch: (async () => {
    throw new Error("no network in memory connector");
  }) as unknown as typeof fetch,
  getAppToken: async () => "",
};

test("in-memory CRUD lifecycle with createdBy", async () => {
  const r = inMemoryResource({
    name: "v",
    label: "V",
    labelSingular: "V",
    fields: [{ name: "createdBy", label: "", type: "text" }],
    access: { list: "*" },
    seed: [{ id: "a", x: 1 }, { x: 2 }],
  });

  let listed = await r.list(ctx, { page: 1, pageSize: 10 });
  assert.equal(listed.total, 2);

  const created = await r.create!(ctx, { x: 3 });
  assert.ok(created.id);
  assert.equal(created.createdBy, "u@x");

  const got = await r.get!(ctx, created.id);
  assert.equal(got?.x, 3);

  const updated = await r.update!(ctx, created.id, { x: 9 });
  assert.equal(updated.x, 9);

  await r.remove!(ctx, created.id);
  assert.equal(await r.get!(ctx, created.id), null);

  listed = await r.list(ctx, { page: 1, pageSize: 10 });
  assert.equal(listed.total, 2);
});

test("update/remove of missing record throws 404 ConnectorError", async () => {
  const r = inMemoryResource({ name: "v2", label: "", labelSingular: "", fields: [], access: { list: "*" } });
  await assert.rejects(() => r.update!(ctx, "nope", {}), /Not found/);
  await assert.rejects(() => r.remove!(ctx, "nope"), /Not found/);
});

test("pagination slices by page/pageSize", async () => {
  const seed = Array.from({ length: 5 }, (_, i) => ({ id: String(i + 1), n: i }));
  const r = inMemoryResource({ name: "p", label: "", labelSingular: "", fields: [], access: { list: "*" }, seed });
  const page2 = await r.list(ctx, { page: 2, pageSize: 2 });
  assert.equal(page2.total, 5);
  assert.deepEqual(page2.data.map((x) => x.id), ["3", "4"]);
});
