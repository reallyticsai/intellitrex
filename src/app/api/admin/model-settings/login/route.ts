import { NextRequest } from "next/server";
import { operatorConfig } from "@/lib/server/config";
import { AppError } from "@/lib/server/errors";
import { errorResponse, jsonResponse, readJson } from "@/lib/server/http";
import { consumeLoginAttempt, issueSession, requireSameOrigin, SESSION_COOKIE, SESSION_SECONDS, verifyOperatorPassword } from "@/lib/server/model-settings-auth";
import { objectInput } from "@/lib/server/model-configurations/validation";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request);
    consumeLoginAttempt();
    const config = operatorConfig();
    const input = objectInput(await readJson(request, 2048), ["password"]);
    if (typeof input.password !== "string" || !input.password || input.password.length > 1024) throw new AppError("INVALID_INPUT", "Enter your operator password.");
    if (!await verifyOperatorPassword(input.password, config.passwordHash)) throw new AppError("INVALID_CREDENTIALS", "The operator password is incorrect.", 401);
    const now = Date.now();
    const response = jsonResponse({ authenticated: true, expiresAt: now + SESSION_SECONDS * 1000 });
    response.cookies.set(SESSION_COOKIE, issueSession(config, now), { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/api/admin", maxAge: SESSION_SECONDS });
    return response;
  } catch (error) { return errorResponse(error); }
}

export async function DELETE(request: NextRequest) {
  try {
    requireSameOrigin(request);
    const response = jsonResponse({ authenticated: false });
    response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/api/admin", maxAge: 0 });
    return response;
  } catch (error) { return errorResponse(error); }
}
