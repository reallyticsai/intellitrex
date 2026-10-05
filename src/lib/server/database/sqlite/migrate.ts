import "server-only";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { DatabaseSync } from "node:sqlite";
import { AppError } from "../../errors";
import { SCHEMA_VERSION, verifySchema } from "./connection";

export function migrateDatabase(database: DatabaseSync) {
  database.exec("BEGIN IMMEDIATE");
  try {
    const version = Number(database.prepare("PRAGMA user_version").get()?.user_version);
    if (version > SCHEMA_VERSION) throw new AppError("SCHEMA_MISMATCH", "The database is newer than this application.", 503);
    if (version === 0) {
      const file = fileURLToPath(new URL("./migrations/001-model-configurations.sql", import.meta.url));
      database.exec(readFileSync(file, "utf8"));
      database.exec("PRAGMA user_version = 1");
    }
    verifySchema(database);
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}
