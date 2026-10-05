import { modelConfigurationService } from "@/lib/server/model-configurations";
import { endpoint } from "@/lib/server/http";
import { requireOperator, requireSameOrigin } from "@/lib/server/model-settings-auth";

export const runtime = "nodejs";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return endpoint(async () => {
    requireSameOrigin(request); requireOperator(request);
    return { configuration: await modelConfigurationService().activate((await context.params).id) };
  });
}
