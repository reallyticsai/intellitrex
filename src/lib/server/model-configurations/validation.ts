import "server-only";
import { AppError } from "../errors";
import type { ConfigurationInput } from "./types";

export const PROVIDER_ROOTS = ["https://api.openai.com/v1", "https://openrouter.ai/api/v1"] as const;

export function objectInput(value: unknown, allowed: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new AppError("INVALID_INPUT", "Expected a JSON object.");
  const object = value as Record<string, unknown>;
  if (Object.keys(object).some((key) => !allowed.includes(key))) throw new AppError("INVALID_INPUT", "The request contains unsupported fields.");
  return object;
}

export function textInput(value: unknown, label: string, max: number): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max || /[\x00-\x1f\x7f]/.test(value)) {
    throw new AppError("INVALID_INPUT", `${label} must be nonempty text of at most ${max} characters without control characters.`);
  }
  return value.trim();
}

export function normalizeBaseUrl(value: unknown): string {
  const text = textInput(value, "API root", 200);
  let url: URL;
  try { url = new URL(text); } catch { throw new AppError("INVALID_INPUT", "Enter a valid HTTPS API root."); }
  if (url.username || url.password || url.search || url.hash || url.protocol !== "https:" || (url.port && url.port !== "443")) {
    throw new AppError("INVALID_INPUT", "API roots must use HTTPS without credentials, query strings, or fragments.");
  }
  const root = url.href.replace(/\/$/, "");
  if (!PROVIDER_ROOTS.some((candidate) => candidate === root)) throw new AppError("INVALID_INPUT", "This version supports the OpenAI and OpenRouter API roots only.");
  return root;
}

export function validateConfiguration(value: unknown, create = false): ConfigurationInput {
  const input = objectInput(value, ["name", "baseUrl", "modelId", "apiKey"]);
  const result: ConfigurationInput = {
    name: textInput(input.name, "Name", 100),
    baseUrl: normalizeBaseUrl(input.baseUrl),
    modelId: textInput(input.modelId, "Model ID", 200),
  };
  if (input.apiKey !== undefined) result.apiKey = textInput(input.apiKey, "API key", 4096);
  if (create && !result.apiKey) throw new AppError("INVALID_INPUT", "An API key is required for a new configuration.");
  return result;
}
