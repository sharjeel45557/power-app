import { test } from "node:test";
import assert from "node:assert/strict";
import { toEntityMeta } from "../src/index.js";

test("toEntityMeta projects fields, defaultSort and workflow", () => {
  // The table/schemas are runtime-opaque to toEntityMeta, so stubs suffice.
  const def = {
    name: "x",
    label: "X",
    labelSingular: "X item",
    table: {} as never,
    createSchema: {} as never,
    updateSchema: {} as never,
    fields: [{ name: "a", label: "A", type: "text" as const }],
    access: { list: "*" as const },
    defaultSort: { field: "a", dir: "asc" as const },
    workflow: { field: "status", initial: "s", states: [], transitions: [] },
  };
  const meta = toEntityMeta(def);
  assert.equal(meta.name, "x");
  assert.equal(meta.labelSingular, "X item");
  assert.deepEqual(meta.fields, def.fields);
  assert.deepEqual(meta.defaultSort, { field: "a", dir: "asc" });
  assert.equal(meta.workflow?.initial, "s");
});
