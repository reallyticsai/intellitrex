import "server-only";
import { databaseConfig, encryptionKey } from "../config";
import { openDatabase } from "../database/sqlite/connection";
import { SqliteModelConfigurationRepository } from "../database/sqlite/model-configuration-repository";
import { ModelConfigurationService } from "./service";
import type { DatabaseSync } from "node:sqlite";

const globalDatabase = globalThis as typeof globalThis & { modelDatabase?: { path: string; connection: DatabaseSync } };

export function modelConfigurationService() {
  const { path } = databaseConfig();
  const key = encryptionKey();
  if (globalDatabase.modelDatabase?.path !== path) {
    globalDatabase.modelDatabase?.connection.close();
    globalDatabase.modelDatabase = { path, connection: openDatabase(path) };
  }
  return new ModelConfigurationService(new SqliteModelConfigurationRepository(globalDatabase.modelDatabase.connection), key);
}
