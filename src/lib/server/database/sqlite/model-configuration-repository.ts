import "server-only";
import type { DatabaseSync, SQLOutputValue } from "node:sqlite";
import { AppError, storageError } from "../../errors";
import type { ModelConfigurationRepository } from "../../model-configurations/repository";
import type { ModelConfiguration } from "../../model-configurations/types";

function mapRow(row: Record<string, SQLOutputValue> | undefined): ModelConfiguration | null {
  return row ? {
    id: String(row.id), name: String(row.name), baseUrl: String(row.base_url), modelId: String(row.model_id),
    apiKeyEncrypted: String(row.api_key_encrypted), isActive: row.is_active === 1,
    createdAt: String(row.created_at), updatedAt: String(row.updated_at),
  } : null;
}

export class SqliteModelConfigurationRepository implements ModelConfigurationRepository {
  constructor(private readonly database: DatabaseSync) {}

  private run<T>(operation: () => T): T {
    try { return operation(); } catch (error) {
      if (error instanceof AppError) throw error;
      throw storageError();
    }
  }

  private find(id: string) {
    return mapRow(this.database.prepare("SELECT * FROM model_configurations WHERE id = ?").get(id));
  }

  private require(id: string) {
    const row = this.find(id);
    if (!row) throw new AppError("NOT_FOUND", "Model configuration was not found.", 404);
    return row;
  }

  private transaction<T>(operation: () => T): T {
    return this.run(() => {
      this.database.exec("BEGIN IMMEDIATE");
      try {
        const result = operation();
        this.database.exec("COMMIT");
        return result;
      } catch (error) {
        this.database.exec("ROLLBACK");
        throw error;
      }
    });
  }

  async list() {
    return this.run(() => this.database.prepare("SELECT * FROM model_configurations ORDER BY created_at, id").all().map((row) => mapRow(row)!));
  }
  async findById(id: string) { return this.run(() => this.find(id)); }
  async findActive() { return this.run(() => mapRow(this.database.prepare("SELECT * FROM model_configurations WHERE is_active = 1").get())); }
  async create(record: ModelConfiguration) {
    return this.run(() => {
      this.database.prepare("INSERT INTO model_configurations (id, name, base_url, model_id, api_key_encrypted, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 0, ?, ?)")
        .run(record.id, record.name, record.baseUrl, record.modelId, record.apiKeyEncrypted, record.createdAt, record.updatedAt);
      return this.require(record.id);
    });
  }
  async update(id: string, changes: Pick<ModelConfiguration, "name" | "baseUrl" | "modelId" | "updatedAt"> & { apiKeyEncrypted?: string }) {
    return this.transaction(() => {
      const current = this.require(id);
      const connectionChanged = changes.baseUrl !== current.baseUrl || changes.modelId !== current.modelId || changes.apiKeyEncrypted !== undefined;
      this.database.prepare("UPDATE model_configurations SET name = ?, base_url = ?, model_id = ?, api_key_encrypted = ?, is_active = ?, updated_at = ? WHERE id = ?")
        .run(changes.name, changes.baseUrl, changes.modelId, changes.apiKeyEncrypted ?? current.apiKeyEncrypted, current.isActive && !connectionChanged ? 1 : 0, changes.updatedAt, id);
      return this.require(id);
    });
  }
  async activate(id: string) {
    return this.transaction(() => {
      this.require(id);
      const now = new Date().toISOString();
      this.database.prepare("UPDATE model_configurations SET is_active = 0, updated_at = ? WHERE is_active = 1").run(now);
      this.database.prepare("UPDATE model_configurations SET is_active = 1, updated_at = ? WHERE id = ?").run(now, id);
      return this.require(id);
    });
  }
  async deleteInactive(id: string) {
    this.transaction(() => {
      if (this.require(id).isActive) throw new AppError("ACTIVE_CONFIGURATION", "Activate a replacement before deleting the active configuration.", 409);
      this.database.prepare("DELETE FROM model_configurations WHERE id = ?").run(id);
    });
  }
}
