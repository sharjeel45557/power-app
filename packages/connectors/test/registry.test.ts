import { test } from "node:test";
import assert from "node:assert/strict";
import { ConnectorRegistry, inMemoryResource, resourceCapabilities } from "../src/index.js";

test("registry register/get/list and duplicate rejection", () => {
  const reg = new ConnectorRegistry();
  const res = inMemoryResource({ name: "a", label: "A", labelSingular: "A", fields: [], access: { list: "*" } });
  reg.register(res);
  assert.equal(reg.get("a"), res);
  assert.equal(reg.get("b"), null);
  assert.equal(reg.size, 1);
  assert.deepEqual(reg.list(), [res]);
  assert.throws(() => reg.register(res));
});

test("resourceCapabilities derives from defined methods", () => {
  const ro = inMemoryResource({ name: "ro", label: "", labelSingular: "", fields: [], access: { list: "*" }, readOnly: true });
  assert.deepEqual(resourceCapabilities(ro), {
    list: true,
    read: true,
    create: false,
    update: false,
    delete: false,
  });
  const rw = inMemoryResource({ name: "rw", label: "", labelSingular: "", fields: [], access: { list: "*" } });
  assert.deepEqual(resourceCapabilities(rw), {
    list: true,
    read: true,
    create: true,
    update: true,
    delete: true,
  });
});
