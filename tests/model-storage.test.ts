import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { backup } from "node:sqlite";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { openDatabase, verifySchema } from "../src/lib/server/database/sqlite/connection";
import { migrateDatabase } from "../src/lib/server/database/sqlite/migrate";
import { SqliteModelConfigurationRepository } from "../src/lib/server/database/sqlite/model-configuration-repository";
import { ModelConfigurationService } from "../src/lib/server/model-configurations/service";
import { encryptCredential, decryptCredential } from "../src/lib/server/credential-encryption";
import { databaseConfig, secret } from "../src/lib/server/config";

const input = { name: "First", baseUrl: "https://openrouter.ai/api/v1", modelId: "openai/gpt-4o-mini", apiKey: "test-only-private-credential" };
function fixture() {
  const directory = mkdtempSync(join(tmpdir(), "intellitrex-test-"));
  const path = join(directory, "models.sqlite");
  const database = openDatabase(path, true);
  migrateDatabase(database);
  const repository = new SqliteModelConfigurationRepository(database);
  const key = randomBytes(32);
  const service = new ModelConfigurationService(repository, key);
  return { directory, path, database, repository, key, service, close: () => { database.close(); rmSync(directory, { recursive: true, force: true }); } };
}

test("saved configurations survive reopen and public views never contain keys", async () => {
  const f = fixture();
  try {
    const first = await f.service.create(input);
    await f.service.create({ ...input, name: "Second" });
    assert.equal((await f.service.list()).length, 2);
    assert.equal(first.isActive, false);
    assert.equal(first.hasApiKey, true);
    assert.equal("apiKeyEncrypted" in first, false);
    assert.equal("apiKey" in first, false);
    assert.equal((await f.repository.findById(first.id))!.apiKeyEncrypted.includes(input.apiKey), false);
    const reopened = openDatabase(f.path);
    try { assert.equal((await new SqliteModelConfigurationRepository(reopened).list()).length, 2); }
    finally { reopened.close(); }
    assert.equal(readFileSync(f.path).includes(Buffer.from(input.apiKey)), false);
  } finally { f.close(); }
});

test("encryption is randomized and rejects tampering and wrong keys", () => {
  const key = randomBytes(32);
  const envelope = encryptCredential(input.apiKey, key);
  assert.notEqual(envelope, encryptCredential(input.apiKey, key));
  assert.equal(decryptCredential(envelope, key), input.apiKey);
  assert.throws(() => decryptCredential(envelope, randomBytes(32)), /could not be decrypted/);
  const parts = envelope.split(".");
  const bytes = Buffer.from(parts[3], "base64"); bytes[0] ^= 1; parts[3] = bytes.toString("base64");
  assert.throws(() => decryptCredential(parts.join("."), key), /could not be decrypted/);
});

test("editing retains omitted credentials; active connection edits deactivate", async () => {
  const f = fixture();
  try {
    const first = await f.service.create(input);
    await f.service.activate(first.id);
    const before = (await f.repository.findById(first.id))!;
    const renamed = await f.service.update(first.id, { name: "Renamed", baseUrl: input.baseUrl, modelId: input.modelId });
    assert.equal(renamed.isActive, true);
    assert.equal((await f.repository.findById(first.id))!.apiKeyEncrypted, before.apiKeyEncrypted);
    const changed = await f.service.update(first.id, { name: "Renamed", baseUrl: input.baseUrl, modelId: input.modelId, apiKey: "replacement-test-key" });
    assert.equal(changed.isActive, false);
    assert.equal((await f.service.connection(first.id)).apiKey, "replacement-test-key");
    await assert.rejects(f.service.update(first.id, { name: "Renamed", baseUrl: input.baseUrl, modelId: input.modelId, apiKey: null }), /API key/);
  } finally { f.close(); }
});

test("activation rolls back on failure and active deletion is rejected", async () => {
  const f = fixture();
  try {
    const first = await f.service.create(input);
    const second = await f.service.create({ ...input, name: "Second" });
    await f.service.activate(first.id);
    await assert.rejects(f.service.activate("missing"), /not found/);
    assert.equal((await f.repository.findActive())!.id, first.id);
    f.database.exec(`CREATE TRIGGER fail_activation BEFORE UPDATE ON model_configurations WHEN NEW.id = '${second.id}' AND NEW.is_active = 1 BEGIN SELECT RAISE(ABORT, 'test failure'); END`);
    await assert.rejects(f.service.activate(second.id), /storage is unavailable/);
    assert.equal((await f.repository.findActive())!.id, first.id);
    f.database.exec("DROP TRIGGER fail_activation");
    await assert.rejects(f.service.delete(first.id), /replacement/);
    await f.service.delete(second.id);
    assert.equal((await f.repository.findActive())!.id, first.id);
    assert.throws(() => f.database.prepare("UPDATE model_configurations SET is_active=2 WHERE id=?").run(first.id));
  } finally { f.close(); }
});

test("two independent processes serialize activation and preserve one active row", async () => {
  const f = fixture();
  try {
    const first = await f.service.create(input);
    const second = await f.service.create({ ...input, name: "Second" });
    const run = promisify(execFile);
    const args = ["--conditions=react-server", "--import", "tsx", "tests/activation-worker.ts", f.path];
    await Promise.all([run(process.execPath, [...args, first.id]), run(process.execPath, [...args, second.id])]);
    assert.equal((await f.repository.list()).filter((row) => row.isActive).length, 1);
    assert.throws(() => f.database.exec("UPDATE model_configurations SET is_active=1"));
  } finally { f.close(); }
});

test("migrations repeat safely, reject newer versions, and rollback invalid initial schemas", () => {
  const f = fixture();
  try {
    migrateDatabase(f.database); verifySchema(f.database);
    f.database.exec("PRAGMA user_version=2");
    assert.throws(() => migrateDatabase(f.database), /newer/);
    assert.equal(f.database.prepare("PRAGMA user_version").get()?.user_version, 2);
    const broken = openDatabase(join(f.directory, "broken.sqlite"), true);
    try {
      broken.exec("CREATE TABLE model_configurations(id TEXT)");
      assert.throws(() => migrateDatabase(broken));
      assert.equal(broken.prepare("PRAGMA user_version").get()?.user_version, 0);
    } finally { broken.close(); }
  } finally { f.close(); }
});

test("backup restores records and readable credentials", async () => {
  const f = fixture();
  try {
    const first = await f.service.create(input); await f.service.activate(first.id);
    const destination = join(f.directory, "backup.sqlite");
    await backup(f.database, destination);
    const restored = openDatabase(destination);
    try {
      const service = new ModelConfigurationService(new SqliteModelConfigurationRepository(restored), f.key);
      assert.equal((await service.list()).length, 1);
      assert.equal((await service.connection()).apiKey, input.apiKey);
      assert.equal(restored.prepare("PRAGMA integrity_check").get()?.integrity_check, "ok");
    } finally { restored.close(); }
  } finally { f.close(); }
});

test("empty storage is explicitly unconfigured and wrong-key activation fails", async () => {
  const f = fixture();
  try {
    await assert.rejects(f.service.connection(), /No active model/);
    const row = await f.service.create(input);
    await assert.rejects(new ModelConfigurationService(f.repository, randomBytes(32)).activate(row.id), /could not be decrypted/);
    assert.equal((await f.service.list())[0].isActive, false);
  } finally { f.close(); }
});

test("production rejects relative paths and unsupported engines; missing files are not created", () => {
  assert.throws(() => databaseConfig({ NODE_ENV: "production", MODEL_CONFIG_DATABASE_PATH: "./models.sqlite" }), /absolute/);
  assert.throws(() => databaseConfig({ NODE_ENV: "test", MODEL_CONFIG_DATABASE_ENGINE: "postgres" }), /not implemented/);
  assert.throws(() => secret("TEST_KEY", { NODE_ENV: "test", TEST_KEY: "invalid" }), /base64/);
  assert.throws(() => openDatabase(join(tmpdir(), `missing-${randomBytes(8).toString("hex")}.sqlite`)), /Initialize/);
});
