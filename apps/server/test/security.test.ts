import { test } from "node:test";
import assert from "node:assert/strict";
import { isAllowedOrigin } from "../src/security.js";

test("isAllowedOrigin: absent origin allowed (same-origin / non-browser)", () => {
  assert.equal(isAllowedOrigin(undefined, new Set(["http://localhost:8080"])), true);
});

test("isAllowedOrigin: matching origin allowed, others blocked", () => {
  const allowed = new Set(["http://localhost:8080"]);
  assert.equal(isAllowedOrigin("http://localhost:8080", allowed), true);
  assert.equal(isAllowedOrigin("http://evil.example", allowed), false);
});

test("isAllowedOrigin: trailing slash normalised", () => {
  const allowed = new Set(["https://app.example"]);
  assert.equal(isAllowedOrigin("https://app.example/", allowed), true);
});
