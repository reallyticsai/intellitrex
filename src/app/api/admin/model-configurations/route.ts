import { modelConfigurationService } from "@/lib/server/model-configurations";
import { endpoint, readJson } from "@/lib/server/http";
import { requireOperator, requireSameOrigin } from "@/lib/server/model-settings-auth";

export const runtime = "nodejs";
export async function GET(request: Request) {
  return endpoint(async () => {
    requireOperator(request);
    return { configurations: await modelConfigurationService().list() };
  });
}
export async function POST(request: Request) {
  return endpoint(async () => {
    requireSameOrigin(request); requireOperator(request);
    return { configuration: await modelConfigurationService().create(await readJson(request)) };
  }, 201);
}
