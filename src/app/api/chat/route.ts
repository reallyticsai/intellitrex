import { NextRequest } from "next/server";
import { completeChat, type ChatMessage } from "@/lib/server/chat-completions-client";
import { modelConfigurationService } from "@/lib/server/model-configurations";
import { endpoint, readJson } from "@/lib/server/http";
import { AppError } from "@/lib/server/errors";
import { objectInput } from "@/lib/server/model-configurations/validation";

export const runtime = "nodejs";

const MODE_PROMPTS: Record<string, string> = {
  "risk-averse": `You are the Intellitrex Bot in Risk-Averse Mode. You focus on low-risk, long-term cryptocurrency investment strategies. Emphasize established cryptocurrencies with stable performance. Provide conservative trading analytics. Always remind users this is not financial advice.`,
  "active-trader": `You are the Intellitrex Bot in Active Trader Mode. You help frequent traders with real-time market insights, technical analysis, and short-term trading strategies. Discuss indicators like RSI, Bollinger Bands, Moving Averages. Always remind users this is not financial advice.`,
  learning: `You are the Intellitrex Bot in Learning Mode. You explain cryptocurrency concepts, trading terminology, and market mechanics in simple terms. Be educational and patient. Use analogies. Always remind users this is not financial advice and suggest paper trading before real trading.`,
};

export async function POST(req: NextRequest) {
  return endpoint(async () => {
    const input = objectInput(await readJson(req, 131072), ["message", "mode", "history"]);
    if (typeof input.message !== "string" || !input.message.trim() || input.message.length > 8000) throw new AppError("INVALID_INPUT", "Enter a message of at most 8,000 characters.");
    const mode = input.mode === undefined ? "active-trader" : input.mode;
    if (typeof mode !== "string" || !Object.hasOwn(MODE_PROMPTS, mode)) throw new AppError("INVALID_INPUT", "Select a supported advisor mode.");
    const history = input.history ?? [];
    if (!Array.isArray(history) || history.length > 10) throw new AppError("INVALID_INPUT", "Conversation history must contain at most ten messages.");
    const messages: ChatMessage[] = [{ role: "system", content: MODE_PROMPTS[mode] }];
    for (const entry of history) {
      const item = objectInput(entry, ["role", "content"]);
      if ((item.role !== "user" && item.role !== "assistant") || typeof item.content !== "string" || !item.content.trim() || item.content.length > 8000) throw new AppError("INVALID_INPUT", "Conversation history contains an unsupported message.");
      messages.push({ role: item.role, content: item.content });
    }
    messages.push({ role: "user", content: input.message });
    const connection = await modelConfigurationService().connection();
    return { response: await completeChat(connection, messages) };
  });
}
