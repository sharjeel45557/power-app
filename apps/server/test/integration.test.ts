import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "@power-app/core";
import { buildApp, type BuiltApp } from "../src/app.js";

const DB = process.env.DATABASE_URL;

function baseEnv(extra: Record<string, string>) {
  return {
    NODE_ENV: "test",
    AUTH_MODE: "mock",
    DATABASE_URL: DB,
    CONNECTORS_DEMO: "true",
    ...extra,
  };
}

const key = (n: number) => Buffer.alloc(32, n).toString("base64");

/** Logs in via the mock provider and returns a Cookie header (wire-encoded). */
async function mockLogin(built: BuiltApp): Promise<string> {
  const res = await built.app.inject({ method: "GET", url: "/auth/login" });
  const setCookie = res.headers["set-cookie"];
  const raw = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  return raw ? raw.split(";")[0]! : "";
}

describe(
  "server integration",
  { skip: DB ? false : "DATABASE_URL not set" },
  () => {
    let admin: BuiltApp;
    let viewer: BuiltApp;
    let adminCookie = "";
    let viewerCookie = "";
    const createdIds: string[] = [];

    before(async () => {
      admin = await buildApp(loadConfig(baseEnv({ SESSION_KEYS: key(1) })));
      viewer = await buildApp(
        loadConfig(baseEnv({ SESSION_KEYS: key(2), ROLE_MAPPINGS: '{"g":"viewer"}' })),
      );
      adminCookie = await mockLogin(admin);
      viewerCookie = await mockLogin(viewer);
    });

    after(async () => {
      for (const id of createdIds) {
        await admin.app
          .inject({ method: "DELETE", url: `/api/entities/requests/${id}`, headers: { cookie: adminCookie } })
          .catch(() => {});
      }
      await admin?.close();
      await viewer?.close();
    });

    test("health and readiness", async () => {
      const health = await admin.app.inject({ method: "GET", url: "/healthz" });
      assert.equal(health.statusCode, 200);
      assert.equal(health.json().status, "ok");
      const ready = await admin.app.inject({ method: "GET", url: "/readyz" });
      assert.equal(ready.statusCode, 200);
    });

    test("auth: 401 without session, user after mock login", async () => {
      const anon = await admin.app.inject({ method: "GET", url: "/auth/me" });
      assert.equal(anon.statusCode, 401);
      const me = await admin.app.inject({ method: "GET", url: "/auth/me", headers: { cookie: adminCookie } });
      assert.equal(me.statusCode, 200);
      assert.ok(me.json().user.roles.includes("admin"));
    });

    test("entity create + validation + list", async () => {
      const ok = await admin.app.inject({
        method: "POST",
        url: "/api/entities/requests",
        headers: { cookie: adminCookie },
        payload: { title: "Integration test request", category: "it", priority: "high" },
      });
      assert.equal(ok.statusCode, 201);
      const id = ok.json().data.id as string;
      createdIds.push(id);

      const bad = await admin.app.inject({
        method: "POST",
        url: "/api/entities/requests",
        headers: { cookie: adminCookie },
        payload: { title: "x" },
      });
      assert.equal(bad.statusCode, 422);

      const list = await admin.app.inject({
        method: "GET",
        url: "/api/entities/requests",
        headers: { cookie: adminCookie },
      });
      assert.equal(list.statusCode, 200);
      assert.ok(list.json().total >= 1);
    });

    test("workflow transitions enforce state and notes", async () => {
      const created = await admin.app.inject({
        method: "POST",
        url: "/api/entities/requests",
        headers: { cookie: adminCookie },
        payload: { title: "Workflow request", category: "clinical" },
      });
      const id = created.json().data.id as string;
      createdIds.push(id);

      const illegal = await admin.app.inject({
        method: "POST",
        url: `/api/entities/requests/${id}/transitions`,
        headers: { cookie: adminCookie },
        payload: { transition: "approve" },
      });
      assert.equal(illegal.statusCode, 409);

      const review = await admin.app.inject({
        method: "POST",
        url: `/api/entities/requests/${id}/transitions`,
        headers: { cookie: adminCookie },
        payload: { transition: "start_review" },
      });
      assert.equal(review.statusCode, 200);
      assert.equal(review.json().data.status, "in_review");

      const noNote = await admin.app.inject({
        method: "POST",
        url: `/api/entities/requests/${id}/transitions`,
        headers: { cookie: adminCookie },
        payload: { transition: "reject" },
      });
      assert.equal(noNote.statusCode, 422);
    });

    test("RBAC: viewer can create but not delete", async () => {
      const create = await viewer.app.inject({
        method: "POST",
        url: "/api/entities/requests",
        headers: { cookie: viewerCookie },
        payload: { title: "Viewer made this" },
      });
      assert.equal(create.statusCode, 201);
      createdIds.push(create.json().data.id as string);

      const del = await viewer.app.inject({
        method: "DELETE",
        url: `/api/entities/requests/${create.json().data.id}`,
        headers: { cookie: viewerCookie },
      });
      assert.equal(del.statusCode, 403);
    });

    test("connector list + unified sources", async () => {
      const list = await admin.app.inject({
        method: "GET",
        url: "/api/connectors/vendor_contacts",
        headers: { cookie: adminCookie },
      });
      assert.equal(list.statusCode, 200);
      assert.ok(list.json().data.length >= 3);

      const sources = await admin.app.inject({
        method: "GET",
        url: "/api/meta/sources",
        headers: { cookie: adminCookie },
      });
      const names = sources.json().sources.map((s: { name: string }) => s.name);
      assert.ok(names.includes("requests"));
      assert.ok(names.includes("vendor_contacts"));
    });

    test("CSRF: cross-origin mutation is blocked", async () => {
      const res = await admin.app.inject({
        method: "POST",
        url: "/api/entities/requests",
        headers: { cookie: adminCookie, origin: "http://evil.example" },
        payload: { title: "Should be blocked" },
      });
      assert.equal(res.statusCode, 403);
    });
  },
);
