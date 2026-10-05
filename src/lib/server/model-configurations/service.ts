import "server-only";
import { randomUUID } from "node:crypto";
import { decryptCredential, encryptCredential } from "../credential-encryption";
import { AppError } from "../errors";
import type { ModelConfigurationRepository } from "./repository";
import type { ModelConfiguration, PublicModelConfiguration } from "./types";
import { validateConfiguration } from "./validation";

function publicView(row: ModelConfiguration): PublicModelConfiguration {
  return { id: row.id, name: row.name, baseUrl: row.baseUrl, modelId: row.modelId,
    isActive: row.isActive, createdAt: row.createdAt, updatedAt: row.updatedAt, hasApiKey: !!row.apiKeyEncrypted };
}

export class ModelConfigurationService {
  constructor(private readonly repository: ModelConfigurationRepository, private readonly key: Buffer) {}
  async list() { return (await this.repository.list()).map(publicView); }
  async create(value: unknown) {
    const input = validateConfiguration(value, true);
    const now = new Date().toISOString();
    return publicView(await this.repository.create({ id: randomUUID(), name: input.name, baseUrl: input.baseUrl,
      modelId: input.modelId, apiKeyEncrypted: encryptCredential(input.apiKey!, this.key), isActive: false, createdAt: now, updatedAt: now }));
  }
  async update(id: string, value: unknown) {
    const input = validateConfiguration(value);
    return publicView(await this.repository.update(id, { name: input.name, baseUrl: input.baseUrl, modelId: input.modelId,
      updatedAt: new Date().toISOString(), ...(input.apiKey ? { apiKeyEncrypted: encryptCredential(input.apiKey, this.key) } : {}) }));
  }
  async activate(id: string) {
    // Refuse to activate unreadable credentials, including after accidental key rotation.
    await this.connection(id);
    return publicView(await this.repository.activate(id));
  }
  async delete(id: string) { await this.repository.deleteInactive(id); }
  async connection(id?: string) {
    const record = id ? await this.repository.findById(id) : await this.repository.findActive();
    if (!record) throw new AppError(id ? "NOT_FOUND" : "MODEL_UNCONFIGURED", id ? "Model configuration was not found." : "No active model is configured. Ask the operator to activate one in Model Settings.", id ? 404 : 503);
    return { baseUrl: record.baseUrl, modelId: record.modelId, apiKey: decryptCredential(record.apiKeyEncrypted, this.key) };
  }
}
