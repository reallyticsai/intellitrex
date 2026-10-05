import "server-only";
import { DatabaseSync } from "node:sqlite";
import { chmodSync, existsSync } from "node:fs";
import { AppError, storageError } from "../../errors";

export const SCHEMA_VERSION = 1;

export function openDatabase(path: string, initialize = false): DatabaseSync {
  if (!initialize && !existsSync(path)) throw new AppError("DATABASE_NOT_INITIALIZED", "Initialize model storage with npm run db:migrate.", 503);
  let database: DatabaseSync | undefined;
  try {
    database = new DatabaseSync(path, { allowExtension: false });
    if (path !== ":memory:") chmodSync(path, 0o600);
    database.exec("PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON; PRAGMA synchronous = FULL;");
    const mode = database.prepare("PRAGMA journal_mode = WAL").get()?.journal_mode;
    if (path !== ":memory:" && mode !== "wal") throw new Error();
    if (!initialize) verifySchema(database);
    return database;
  } catch (error) {
    database?.close();
    if (error instanceof AppError) throw error;
    throw storageError();
  }
}

export function verifySchema(database: DatabaseSync) {
  const version = database.prepare("PRAGMA user_version").get()?.user_version;
  if (version !== SCHEMA_VERSION) throw new AppError("SCHEMA_MISMATCH", "Model storage schema is incompatible. Run the matching database migrations.", 503);
  const table = database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='model_configurations'").get();
  const index = database.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='one_active_model_configuration'").get();
  if (!table || !index) throw new AppError("SCHEMA_MISMATCH", "Model storage schema is incomplete.", 503);
  database.prepare("SELECT id, name, base_url, model_id, api_key_encrypted, is_active, created_at, updated_at FROM model_configurations LIMIT 0").all();
}
