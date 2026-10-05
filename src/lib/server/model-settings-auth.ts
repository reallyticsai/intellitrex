import "server-only";
import { createHash, createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { operatorConfig } from "./config";
import { AppError } from "./errors";

const scryptAsync = promisify(scrypt);
export const SESSION_COOKIE = "intellitrex-model-settings";
export const SESSION_SECONDS = 3600;

export async function hashOperatorPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const hash = await scryptAsync(password, salt, 64) as Buffer;
  return `scrypt$${salt}$${hash.toString("hex")}`;
}

export async function verifyOperatorPassword(password: string, encoded: string) {
  const [, salt, hash] = encoded.split("$");
  if (!salt || !hash || !/^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(encoded)) return false;
  const derived = await scryptAsync(password, salt, 64) as Buffer;
  return timingSafeEqual(derived, Buffer.from(hash, "hex"));
}

function fingerprint(passwordHash: string) { return createHash("sha256").update(passwordHash).digest("hex"); }

export function issueSession(config: ReturnType<typeof operatorConfig>, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ expires: now + SESSION_SECONDS * 1000, nonce: randomBytes(16).toString("hex"), password: fingerprint(config.passwordHash) })).toString("base64url");
  return `${payload}.${createHmac("sha256", config.signingKey).update(payload).digest("base64url")}`;
}

export function validSession(token: string, config: ReturnType<typeof operatorConfig>, now = Date.now()): boolean {
  try {
    if (token.length > 1024) return false;
    const [payload, signature, extra] = token.split(".");
    if (!payload || !signature || extra !== undefined) return false;
    const expected = createHmac("sha256", config.signingKey).update(payload).digest();
    const actual = Buffer.from(signature, "base64url");
    if (actual.length !== expected.length || !timingSafeEqual(expected, actual)) return false;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return typeof data.expires === "number" && data.expires > now && data.expires <= now + SESSION_SECONDS * 1000
      && data.password === fingerprint(config.passwordHash);
  } catch { return false; }
}

export function sessionExpiry(request: Request): number | null {
  const config = operatorConfig();
  const cookie = (request.headers.get("cookie") || "").split(";").map((value) => value.trim()).find((value) => value.startsWith(`${SESSION_COOKIE}=`));
  const token = cookie?.slice(SESSION_COOKIE.length + 1);
  if (!token || !validSession(token, config)) return null;
  return JSON.parse(Buffer.from(token.split(".")[0], "base64url").toString("utf8")).expires as number;
}

export function authenticated(request: Request) { return sessionExpiry(request) !== null; }

export function requireOperator(request: Request) {
  if (!authenticated(request)) throw new AppError("UNAUTHORIZED", "Unlock Model Settings to continue.", 401);
}

export function requireSameOrigin(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) throw new AppError("FORBIDDEN_ORIGIN", "This action must come from this app.", 403);
}

// A process-wide bound avoids trusting client-controlled IP headers. This is
// deliberately single-instance and resets on restart; it is not a distributed limiter.
const limiter = globalThis as typeof globalThis & { modelSettingsAttempts?: { reset: number; count: number } };
export function consumeLoginAttempt(now = Date.now()) {
  if (!limiter.modelSettingsAttempts || limiter.modelSettingsAttempts.reset <= now) limiter.modelSettingsAttempts = { reset: now + 15 * 60 * 1000, count: 0 };
  if (limiter.modelSettingsAttempts.count >= 20) throw new AppError("LOGIN_RATE_LIMITED", "Too many unlock attempts. Try again in 15 minutes.", 429);
  limiter.modelSettingsAttempts.count++;
}
