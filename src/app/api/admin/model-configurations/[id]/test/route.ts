import { modelConfigurationService } from "@/lib/server/model-configurations";
import { completeChat } from "@/lib/server/chat-completions-client";
import { endpoint } from "@/lib/server/http";
import { requireOperator, requireSameOrigin } from "@/lib/server/model-settings-auth";

export const runtime = "nodejs";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return endpoint(async () => {
    requireSameOrigin(request); requireOperator(request);
    const connection = await modelConfigurationService().connection((await context.params).id);
    await completeChat(connection, [{ role: "user", content: "Reply with a brief greeting." }], { test: true });
    return { success: true, message: "Connection successful. The selected model returned a text response." };
  });
}
