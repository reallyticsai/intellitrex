import "server-only";
import { NextResponse } from "next/server";
import { AppError } from "./errors";

export function jsonResponse(value: unknown, status = 200) {
  return NextResponse.json(value, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}

export function errorResponse(error: unknown) {
  if (error instanceof AppError) return jsonResponse({ error: { code: error.code, message: error.message } }, error.status);
  // Never include request contents, keys, provider error bodies, or stack traces.
  return jsonResponse({ error: { code: "INTERNAL_ERROR", message: "The request could not be completed." } }, 500);
}

export async function boundedText(response: Request | Response, maxBytes: number): Promise<string> {
  if (Number(response.headers.get("content-length")) > maxBytes) throw new AppError("PAYLOAD_TOO_LARGE", "The payload exceeds the supported size.", 413);
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      size += next.value.byteLength;
      if (size > maxBytes) throw new AppError("PAYLOAD_TOO_LARGE", "The payload exceeds the supported size.", 413);
      chunks.push(next.value);
    }
  } finally { await reader.cancel().catch(() => {}); }
  return Buffer.concat(chunks).toString("utf8");
}

export async function readJson(request: Request, maxBytes = 16384): Promise<unknown> {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") throw new AppError("INVALID_INPUT", "Send an application/json request.");
  const text = await boundedText(request, maxBytes);
  try { return JSON.parse(text); } catch { throw new AppError("INVALID_INPUT", "The request body is not valid JSON."); }
}

export async function endpoint(operation: () => Promise<unknown>, status = 200) {
  try { return jsonResponse(await operation(), status); } catch (error) { return errorResponse(error); }
}
