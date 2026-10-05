import "server-only";
import { AppError } from "./errors";
import { boundedText } from "./http";
import { normalizeBaseUrl } from "./model-configurations/validation";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };
export type ProviderConnection = { baseUrl: string; modelId: string; apiKey: string };

export async function completeChat(connection: ProviderConnection, messages: ChatMessage[], options: { test?: boolean; fetch?: typeof fetch; timeoutMs?: number } = {}): Promise<string> {
  const root = normalizeBaseUrl(connection.baseUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 30000);
  try {
    const response = await (options.fetch || fetch)(`${root}/chat/completions`, {
      method: "POST", cache: "no-store", redirect: "error", signal: controller.signal,
      headers: { Authorization: `Bearer ${connection.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: connection.modelId, messages, stream: false,
        ...(root === "https://api.openai.com/v1" ? { max_completion_tokens: options.test ? 128 : 1000 } : { max_tokens: options.test ? 128 : 1000 }) }),
    });
    if (!response.ok) {
      await response.body?.cancel();
      if (response.status === 401 || response.status === 403) throw new AppError("PROVIDER_AUTH_FAILED", "The provider rejected this API key or its access permissions.", 502);
      if (response.status === 429) throw new AppError("PROVIDER_RATE_LIMITED", "The provider is rate-limiting requests or has insufficient quota. Try again later or review its account limits.", 502);
      if (response.status === 400 || response.status === 404) throw new AppError("PROVIDER_MODEL_REJECTED", "The provider rejected the model or request. Check the model ID and chat-completions compatibility.", 502);
      throw new AppError("PROVIDER_UNAVAILABLE", "The model provider is unavailable. Try again later.", 502);
    }
    let data;
    try { data = JSON.parse(await boundedText(response, 1024 * 1024)); } catch {
      if (controller.signal.aborted) throw new AppError("PROVIDER_TIMEOUT", "The provider request timed out.", 504);
      throw new AppError("INVALID_PROVIDER_RESPONSE", "The provider returned an invalid response.", 502);
    }
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim() || data.error) throw new AppError("INVALID_PROVIDER_RESPONSE", "The provider did not return an assistant text response. Check model compatibility and output limits.", 502);
    return content;
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (controller.signal.aborted) throw new AppError("PROVIDER_TIMEOUT", "The provider request timed out.", 504);
    throw new AppError("PROVIDER_UNAVAILABLE", "The model provider could not be reached.", 502);
  } finally { clearTimeout(timeout); }
}
