export type ModelConfiguration = {
  id: string;
  name: string;
  baseUrl: string;
  modelId: string;
  apiKeyEncrypted: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PublicModelConfiguration = Omit<ModelConfiguration, "apiKeyEncrypted"> & { hasApiKey: boolean };
export type ConfigurationInput = { name: string; baseUrl: string; modelId: string; apiKey?: string };
