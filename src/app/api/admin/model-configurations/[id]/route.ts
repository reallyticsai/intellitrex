import { modelConfigurationService } from "@/lib/server/model-configurations";
import { endpoint, readJson } from "@/lib/server/http";
import { requireOperator, requireSameOrigin } from "@/lib/server/model-settings-auth";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
export async function PATCH(request: Request, context: Context) {
  return endpoint(async () => {
    requireSameOrigin(request); requireOperator(request);
    return { configuration: await modelConfigurationService().update((await context.params).id, await readJson(request)) };
  });
}
export async function DELETE(request: Request, context: Context) {
  return endpoint(async () => {
    requireSameOrigin(request); requireOperator(request);
    await modelConfigurationService().delete((await context.params).id);
    return { deleted: true };
  });
}
