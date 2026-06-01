import { test } from "node:test";
import assert from "node:assert/strict";
import { can, hasRole, permissionsFor, rolesFromGroups } from "../src/index.js";

const admin = { id: "1", email: "a@x", name: "A", roles: ["admin"] };
const viewer = { id: "2", email: "v@x", name: "V", roles: ["viewer"] };

test("can: '*' allows any authenticated user, denies anonymous", () => {
  assert.equal(can(viewer, "list", { list: "*" }), true);
  assert.equal(can(null, "list", { list: "*" }), false);
});

test("can: role list grants only matching roles", () => {
  assert.equal(can(admin, "delete", { delete: ["admin"] }), true);
  assert.equal(can(viewer, "delete", { delete: ["admin"] }), false);
});

test("can: predicate rule", () => {
  assert.equal(can(admin, "update", { update: (u) => u.email === "a@x" }), true);
  assert.equal(can(viewer, "update", { update: (u) => u.email === "a@x" }), false);
});

test("can: deny by default when no rule", () => {
  assert.equal(can(admin, "create", {}), false);
});

test("permissionsFor maps every action", () => {
  const p = permissionsFor(viewer, {
    list: "*",
    read: "*",
    create: ["admin"],
    update: ["admin"],
    delete: ["admin"],
  });
  assert.deepEqual(p, {
    list: true,
    read: true,
    create: false,
    update: false,
    delete: false,
  });
});

test("rolesFromGroups maps groups and falls back to default", () => {
  assert.deepEqual(rolesFromGroups(["g1"], { g1: "admin" }, "viewer"), ["admin"]);
  assert.deepEqual(rolesFromGroups(["gX"], { g1: "admin" }, "viewer"), ["viewer"]);
  assert.deepEqual(
    rolesFromGroups(["g1", "g2"], { g1: "admin", g2: "editor" }, "viewer"),
    ["admin", "editor"],
  );
});

test("hasRole", () => {
  assert.equal(hasRole(admin, "admin"), true);
  assert.equal(hasRole(viewer, "admin"), false);
  assert.equal(hasRole(null, "admin"), false);
});
