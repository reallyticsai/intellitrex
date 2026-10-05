import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { completeChat } from "../src/lib/server/chat-completions-client";
import { hashOperatorPassword, issueSession, requireSameOrigin, validSession, verifyOperatorPassword } from "../src/lib/server/model-settings-auth";
import { normalizeBaseUrl, validateConfiguration } from "../src/lib/server/model-configurations/validation";
import { readJson } from "../src/lib/server/http";

const connection = { baseUrl: "https://openrouter.ai/api/v1", modelId: "test/model", apiKey: "test-key" };
const messages = [{ role: "user" as const, content: "Hello" }];

test("OpenRouter uses selected model, bounded output, bearer auth, no redirects or caching", async () => {
  let calls = 0;
  const reply = await completeChat(connection, messages, { test: true, fetch: async (url, init) => {
    calls++;
    assert.equal(url, "https://openrouter.ai/api/v1/chat/completions");
    assert.equal(init?.redirect, "error"); assert.equal(init?.cache, "no-store");
    assert.equal((init?.headers as Record<string, string>).Authorization, "Bearer test-key");
    const body = JSON.parse(String(init?.body));
    assert.equal(body.model, connection.modelId); assert.equal(body.max_tokens, 128);
    assert.equal(body.temperature, undefined); assert.deepEqual(body.messages, messages);
    return Response.json({ choices: [{ message: { content: "Hello back" } }] });
  } });
  assert.equal(reply, "Hello back"); assert.equal(calls, 1);
});

test("OpenAI uses its compatible completion budget parameter", async () => {
  await completeChat({ ...connection, baseUrl: "https://api.openai.com/v1" }, messages, { fetch: async (_, init) => {
    const body = JSON.parse(String(init?.body)); assert.equal(body.max_completion_tokens, 1000); assert.equal(body.max_tokens, undefined);
    return Response.json({ choices: [{ message: { content: "ok" } }] });
  } });
});

test("provider failures are sanitized and never retried", async () => {
  for (const status of [401, 403, 429, 400, 404, 500, 302]) {
    let calls = 0;
    await assert.rejects(completeChat(connection, messages, { fetch: async () => { calls++; return new Response("secret provider payload", { status }); } }), (error: Error) => !error.message.includes("secret provider payload"));
    assert.equal(calls, 1);
  }
  for (const body of [{}, { choices: [{ message: { content: "" } }] }, { error: "secret" }]) {
    await assert.rejects(completeChat(connection, messages, { fetch: async () => Response.json(body) }), /did not return/);
  }
  await assert.rejects(completeChat(connection, messages, { fetch: async () => new Response("not-json") }), /invalid response/);
  await assert.rejects(completeChat(connection, messages, { fetch: async () => new Response("x".repeat(1024 * 1024 + 1)) }), /invalid response/);
});

test("provider timeout and blocked redirect/network errors are controlled", async () => {
  await assert.rejects(completeChat(connection, messages, { timeoutMs: 5, fetch: async (_, init) => new Promise((_, reject) => {
    init?.signal?.addEventListener("abort", () => reject(new Error("abort")), { once: true });
  }) }), /timed out/);
  await assert.rejects(completeChat(connection, messages, { fetch: async () => { throw new Error("redirect to internal service"); } }), /could not be reached/);
});

test("endpoint validation blocks arbitrary hosts and malformed configuration input", () => {
  assert.equal(normalizeBaseUrl("https://openrouter.ai/api/v1/"), connection.baseUrl);
  for (const root of ["http://openrouter.ai/api/v1", "https://localhost/v1", "https://127.0.0.1/v1", "https://openrouter.ai/api/v1?key=x", "https://user:pass@openrouter.ai/api/v1", "https://openrouter.ai:444/api/v1", "https://openrouter.ai/api/v1/chat/completions"]) assert.throws(() => normalizeBaseUrl(root));
  assert.throws(() => validateConfiguration({ name: "test", baseUrl: connection.baseUrl, modelId: connection.modelId }, true), /API key/);
  assert.throws(() => validateConfiguration({ name: "test", baseUrl: connection.baseUrl, modelId: connection.modelId, isActive: true }), /unsupported/);
});

test("operator passwords are hashed and session signatures enforce expiry and rotation", async () => {
  const passwordHash = await hashOperatorPassword("test-password-123");
  assert.equal(await verifyOperatorPassword("test-password-123", passwordHash), true);
  assert.equal(await verifyOperatorPassword("wrong", passwordHash), false);
  const config = { passwordHash, signingKey: randomBytes(32) };
  const now = Date.now(); const session = issueSession(config, now);
  assert.equal(validSession(session, config, now), true);
  assert.equal(validSession(session, config, now + 3600001), false);
  assert.equal(validSession(session + "tampered", config, now), false);
  assert.equal(validSession(session, { ...config, signingKey: randomBytes(32) }, now), false);
  assert.equal(validSession(session, { ...config, passwordHash: await hashOperatorPassword("new-password-123") }, now), false);
});

test("same-origin guard and bounded JSON reject unsafe mutations and excess bodies", async () => {
  const url = "http://localhost:3000/api/admin/model-configurations";
  assert.throws(() => requireSameOrigin(new Request(url)), /this app/);
  assert.throws(() => requireSameOrigin(new Request(url, { headers: { origin: "https://foreign.example" } })), /this app/);
  assert.doesNotThrow(() => requireSameOrigin(new Request(url, { headers: { origin: "http://localhost:3000" } })));
  await assert.rejects(readJson(new Request(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: "x".repeat(20) }), 10), /exceeds/);
  await assert.rejects(readJson(new Request(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: "invalid" })), /valid JSON/);
});
