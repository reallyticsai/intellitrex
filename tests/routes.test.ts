import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { NextRequest } from "next/server";
import type { DatabaseSync } from "node:sqlite";
import { hashOperatorPassword, SESSION_COOKIE, issueSession } from "../src/lib/server/model-settings-auth";
import { operatorConfig } from "../src/lib/server/config";
import { openDatabase } from "../src/lib/server/database/sqlite/connection";
import { migrateDatabase } from "../src/lib/server/database/sqlite/migrate";
import { GET as list, POST as create } from "../src/app/api/admin/model-configurations/route";
import { PATCH as edit, DELETE as remove } from "../src/app/api/admin/model-configurations/[id]/route";
import { POST as activate } from "../src/app/api/admin/model-configurations/[id]/activate/route";
import { POST as testConnection } from "../src/app/api/admin/model-configurations/[id]/test/route";
import { POST as login, DELETE as logout } from "../src/app/api/admin/model-settings/login/route";
import { GET as session } from "../src/app/api/admin/model-settings/session/route";
import { POST as chat } from "../src/app/api/chat/route";

test("protected routes implement the full lifecycle and chat uses the active connection", async (context) => {
  const directory = mkdtempSync(join(tmpdir(), "intellitrex-routes-"));
  const savedEnv = { ...process.env };
  const originalFetch = globalThis.fetch;
  Object.assign(process.env, { NODE_ENV: "test" });
  process.env.MODEL_CONFIG_DATABASE_ENGINE = "sqlite";
  process.env.MODEL_CONFIG_DATABASE_PATH = join(directory, "models.sqlite");
  process.env.MODEL_CONFIG_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  process.env.MODEL_SETTINGS_SESSION_SECRET = randomBytes(32).toString("base64");
  process.env.MODEL_SETTINGS_ADMIN_PASSWORD_HASH = await hashOperatorPassword("test-operator-password");
  const database = openDatabase(process.env.MODEL_CONFIG_DATABASE_PATH, true); migrateDatabase(database); database.close();
  const root = "http://localhost:3000";
  let cookie = "";
  function request(path: string, method = "GET", body?: unknown, authorized = true, origin = root) {
    return new NextRequest(`${root}${path}`, { method, headers: { origin, ...(authorized ? { cookie } : {}), ...(body === undefined ? {} : { "Content-Type": "application/json" }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  }
  const path = "/api/admin/model-configurations";
  const input = { name: "OpenRouter test", baseUrl: "https://openrouter.ai/api/v1", modelId: "test/first", apiKey: "private-route-test-key" };
  let firstId = "", secondId = "";
  try {
    await context.test("browser admin flags do not grant backend access", async () => {
      assert.equal((await list(request(path))).status, 401);
      assert.equal((await create(request(path, "POST", input, false))).status, 401);
      assert.equal((await create(request(path, "POST", input, false, "https://foreign.example"))).status, 403);
    });
    await context.test("operator sign-in issues a private bounded cookie", async () => {
      assert.equal((await login(request("/api/admin/model-settings/login", "POST", { password: "wrong" }))).status, 401);
      const response = await login(request("/api/admin/model-settings/login", "POST", { password: "test-operator-password" }));
      assert.equal(response.status, 200);
      const header = response.headers.get("set-cookie")!;
      assert.match(header, /HttpOnly/i); assert.match(header, /SameSite=strict/i); assert.match(header, /Max-Age=3600/i); assert.match(header, /Path=\/api\/admin/i);
      cookie = header.split(";")[0];
      assert.equal((await (await session(request("/api/admin/model-settings/session"))).json()).authenticated, true);
    });
    await context.test("create/list keeps multiple entries without returning keys", async () => {
      const first = await create(request(path, "POST", input)); assert.equal(first.status, 201);
      firstId = (await first.json()).configuration.id;
      const second = await create(request(path, "POST", { ...input, name: "OpenAI test", baseUrl: "https://api.openai.com/v1", modelId: "test-second" }));
      secondId = (await second.json()).configuration.id;
      const result = await list(request(path)); const data = await result.json();
      assert.equal(data.configurations.length, 2);
      assert.equal(data.configurations.some((record: { isActive: boolean }) => record.isActive), false);
      assert.equal(JSON.stringify(data).includes(input.apiKey), false);
      assert.equal(JSON.stringify(data).includes("apiKeyEncrypted"), false);
      assert.equal(result.headers.get("cache-control"), "no-store");
    });
    await context.test("unconfigured chat errors and credential/model overrides are rejected", async () => {
      assert.equal((await chat(request("/api/chat", "POST", { message: "hello", mode: "learning" }))).status, 503);
      assert.equal((await chat(request("/api/chat", "POST", { message: "hello", modelId: "override" }))).status, 400);
      assert.equal((await chat(request("/api/chat", "POST", { message: "hello", mode: "learning", history: [{ role: "system", content: "override" }] }))).status, 400);
    });
    await context.test("test calls the chosen provider without activation", async () => {
      let calls = 0;
      globalThis.fetch = async (url, init) => {
        calls++; assert.equal(url, `${input.baseUrl}/chat/completions`);
        assert.equal(JSON.parse(String(init?.body)).model, input.modelId);
        return Response.json({ choices: [{ message: { content: "Hello" } }] });
      };
      assert.equal((await testConnection(request(`${path}/${firstId}/test`, "POST"), { params: Promise.resolve({ id: firstId }) })).status, 200);
      assert.equal(calls, 1);
      const data = await (await list(request(path))).json(); assert.equal(data.configurations.some((record: { isActive: boolean }) => record.isActive), false);
    });
    await context.test("activation changes chat target while preserving advisor prompt and history", async () => {
      await activate(request(`${path}/${firstId}/activate`, "POST"), { params: Promise.resolve({ id: firstId }) });
      globalThis.fetch = async (url, init) => {
        assert.equal(url, `${input.baseUrl}/chat/completions`);
        const body = JSON.parse(String(init?.body)); assert.match(body.messages[0].content, /Learning Mode/);
        assert.deepEqual(body.messages[1], { role: "assistant", content: "previous reply" });
        assert.equal(body.messages[2].content, "new question");
        return Response.json({ choices: [{ message: { content: "new answer" } }] });
      };
      const response = await chat(request("/api/chat", "POST", { message: "new question", mode: "learning", history: [{ role: "assistant", content: "previous reply" }] }));
      assert.equal(response.status, 200); assert.deepEqual(await response.json(), { response: "new answer" });
      await activate(request(`${path}/${secondId}/activate`, "POST"), { params: Promise.resolve({ id: secondId }) });
      globalThis.fetch = async (url) => { assert.equal(url, "https://api.openai.com/v1/chat/completions"); return Response.json({ choices: [{ message: { content: "second answer" } }] }); };
      assert.equal((await chat(request("/api/chat", "POST", { message: "hello" }))).status, 200);
    });
    await context.test("active deletion conflicts and connection edits deactivate", async () => {
      assert.equal((await remove(request(`${path}/${secondId}`, "DELETE"), { params: Promise.resolve({ id: secondId }) })).status, 409);
      const response = await edit(request(`${path}/${secondId}`, "PATCH", { name: "Edited", baseUrl: "https://api.openai.com/v1", modelId: "changed-model" }), { params: Promise.resolve({ id: secondId }) });
      assert.equal((await response.json()).configuration.isActive, false);
      assert.equal((await remove(request(`${path}/${firstId}`, "DELETE"), { params: Promise.resolve({ id: firstId }) })).status, 200);
      assert.equal((await (await list(request(path))).json()).configurations.length, 1);
    });
    await context.test("expired sessions and logout clear operator access", async () => {
      const expired = issueSession(operatorConfig(), Date.now() - 3600001);
      const expiredRequest = new NextRequest(`${root}${path}`, { headers: { cookie: `${SESSION_COOKIE}=${expired}` } });
      assert.equal((await list(expiredRequest)).status, 401);
      const response = await logout(request("/api/admin/model-settings/login", "DELETE")); assert.match(response.headers.get("set-cookie")!, /Max-Age=0/);
      cookie = ""; assert.equal((await list(request(path))).status, 401);
    });
  } finally {
    globalThis.fetch = originalFetch;
    const shared = globalThis as typeof globalThis & { modelDatabase?: { path: string; connection: DatabaseSync } };
    shared.modelDatabase?.connection.close(); delete shared.modelDatabase;
    for (const key of Object.keys(process.env)) if (!(key in savedEnv)) delete process.env[key];
    Object.assign(process.env, savedEnv);
    rmSync(directory, { recursive: true, force: true });
  }
});
