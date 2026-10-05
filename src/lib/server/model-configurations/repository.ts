import type { ModelConfiguration } from "./types";

export interface ModelConfigurationRepository {
  list(): Promise<ModelConfiguration[]>;
  findById(id: string): Promise<ModelConfiguration | null>;
  findActive(): Promise<ModelConfiguration | null>;
  create(record: ModelConfiguration): Promise<ModelConfiguration>;
  update(id: string, changes: Pick<ModelConfiguration, "name" | "baseUrl" | "modelId" | "updatedAt"> & { apiKeyEncrypted?: string }): Promise<ModelConfiguration>;
  activate(id: string): Promise<ModelConfiguration>;
  deleteInactive(id: string): Promise<void>;
}
