import { existsSync, mkdirSync, chmodSync, appendFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { backup } from "node:sqlite";
import { loadEnvConfig } from "@next/env";
import { databaseConfig, encryptionKey, operatorConfig } from "../src/lib/server/config";
import { decryptCredential } from "../src/lib/server/credential-encryption";
import { openDatabase } from "../src/lib/server/database/sqlite/connection";
import { migrateDatabase } from "../src/lib/server/database/sqlite/migrate";
import { SqliteModelConfigurationRepository } from "../src/lib/server/database/sqlite/model-configuration-repository";
import { ModelConfigurationService } from "../src/lib/server/model-configurations/service";
import { hashOperatorPassword } from "../src/lib/server/model-settings-auth";
import { AppError } from "../src/lib/server/errors";

loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");

function hiddenPrompt(label: string): Promise<string> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error("Operator setup requires an interactive terminal. Configure production secrets through your deployment environment.");
  process.stdout.write(label);
  return new Promise((resolvePrompt, reject) => {
    let value = "";
    process.stdin.setRawMode(true);
    process.stdin.resume();
    function finish() { process.stdin.setRawMode(false); process.stdin.pause(); process.stdin.off("data", onData); process.stdout.write("\n"); }
    function onData(chunk: Buffer) {
      for (const character of chunk.toString("utf8")) {
        if (character === "\u0003") { finish(); reject(new Error("Setup cancelled.")); return; }
        if (character === "\r" || character === "\n") { finish(); resolvePrompt(value); return; }
        if (character === "\u007f" || character === "\b") value = value.slice(0, -1);
        else if (character >= " " && value.length < 1024) value += character;
      }
    }
    process.stdin.on("data", onData);
  });
}

async function setup() {
  if (process.env.NODE_ENV === "production") throw new Error("Provision production secrets externally; local setup must not generate production secrets.");
  const names = ["MODEL_CONFIG_ENCRYPTION_KEY", "MODEL_SETTINGS_ADMIN_PASSWORD_HASH", "MODEL_SETTINGS_SESSION_SECRET"];
  if (names.every((name) => process.env[name])) {
    encryptionKey(); operatorConfig();
    console.log("Operator secrets already exist and were retained. Run npm run db:migrate if storage needs initialization.");
    return;
  }
  if (names.some((name) => process.env[name])) throw new Error("Partial operator setup found. Complete the missing settings manually; existing keys will not be replaced.");
  const password = await hiddenPrompt("Choose an operator password (at least 12 characters; input hidden): ");
  if (password.length < 12) throw new Error("Use at least 12 characters for the operator password.");
  if (password !== await hiddenPrompt("Confirm operator password: ")) throw new Error("Passwords did not match.");
  const values = {
    MODEL_CONFIG_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
    MODEL_SETTINGS_ADMIN_PASSWORD_HASH: await hashOperatorPassword(password),
    MODEL_SETTINGS_SESSION_SECRET: randomBytes(32).toString("base64"),
  };
  const { path } = databaseConfig();
  const envPath = resolve(".env.local");
  // Next's dotenv expansion interprets $, so escape the scrypt hash separators.
  let contents = "\n# Model configuration management (server-only secrets)\n";
  if (!process.env.MODEL_CONFIG_DATABASE_PATH) contents += `MODEL_CONFIG_DATABASE_PATH=${JSON.stringify(path)}\n`;
  if (!process.env.MODEL_CONFIG_DATABASE_ENGINE) contents += "MODEL_CONFIG_DATABASE_ENGINE=sqlite\n";
  for (const [name, value] of Object.entries(values)) contents += `${name}=${value.replace(/\$/g, "\\$")}\n`;
  appendFileSync(envPath, contents, { mode: 0o600 });
  chmodSync(envPath, 0o600);
  Object.assign(process.env, values);
  initialize();
  console.log("Operator setup complete. Secrets were saved to untracked .env.local without printing them. Restart the app, then open /admin and unlock Model Settings.");
}

function initialize() {
  const { path } = databaseConfig();
  if (!existsSync(dirname(path))) {
    if (process.env.NODE_ENV === "production") throw new Error("Provision the persistent production data directory before migrating.");
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  }
  const previousUmask = process.umask(0o077);
  try {
    const database = openDatabase(path, true);
    try { migrateDatabase(database); } finally { database.close(); }
  } finally { process.umask(previousUmask); }
  console.log("Model database migrations complete.");
}

async function main() {
  const command = process.argv[2];
  if (command === "setup") return setup();
  if (command === "migrate") return initialize();
  const { path } = databaseConfig();
  const database = openDatabase(path);
  const repository = new SqliteModelConfigurationRepository(database);
  try {
    if (command === "backup") {
      const destination = process.argv[3];
      if (!destination || !isAbsolute(destination)) throw new Error("Supply an absolute backup destination: npm run db:backup -- /path/to/backup.sqlite");
      if (resolve(destination) === path || existsSync(destination)) throw new Error("Choose a new backup file; existing files will not be overwritten.");
      const previousUmask = process.umask(0o077);
      try { await backup(database, destination); chmodSync(destination, 0o600); }
      finally { process.umask(previousUmask); }
      console.log("Consistent SQLite backup complete. Retain the matching encryption key separately.");
    } else if (command === "verify") {
      if (database.prepare("PRAGMA integrity_check").get()?.integrity_check !== "ok") throw new Error("Database integrity check failed.");
      const rows = await repository.list();
      if (rows.filter((row) => row.isActive).length > 1) throw new Error("Active-model invariant failed.");
      const key = encryptionKey();
      for (const row of rows) decryptCredential(row.apiKeyEncrypted, key);
      console.log(`Database verified: ${rows.length} configuration(s), valid schema, integrity, and readable credentials. No secrets displayed.`);
    } else if (command === "import") {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) throw new Error("OPENAI_API_KEY is not configured. Add a model through the UI instead.");
      const modelId = process.argv[3] || "gpt-4o-mini";
      const name = "Imported OpenAI connection";
      if ((await repository.list()).some((row) => row.name === name && row.modelId === modelId && row.baseUrl === "https://api.openai.com/v1")) {
        console.log("This OpenAI configuration was already imported; no records changed.");
      } else {
        await new ModelConfigurationService(repository, encryptionKey()).create({ name, modelId, baseUrl: "https://api.openai.com/v1", apiKey });
        console.log("Existing OpenAI credential imported as inactive. Test and activate it in Model Settings.");
      }
    } else throw new Error("Unknown command. Use setup, migrate, backup, verify, or import.");
  } finally { database.close(); }
}

main().catch((error) => {
  // Expected local setup errors contain no credentials; driver stack traces are omitted.
  console.error(error instanceof AppError || error instanceof Error ? error.message : "Database command failed.");
  process.exitCode = 1;
});
