import { sessionExpiry } from "@/lib/server/model-settings-auth";
import { endpoint } from "@/lib/server/http";
export const runtime = "nodejs";
export async function GET(request: Request) {
  return endpoint(async () => {
    const expiresAt = sessionExpiry(request);
    return { authenticated: expiresAt !== null, expiresAt };
  });
}
