import "server-only";
import { isAbsolute, resolve } from "node:path";
import { AppError } from "./errors";

function configurationError(message: string): never {
  throw new AppError("SETUP_REQUIRED", message, 503);
}

export function databaseConfig(env: NodeJS.ProcessEnv = process.env) {
  const engine = env.MODEL_CONFIG_DATABASE_ENGINE || "sqlite";
  if (engine !== "sqlite") configurationError("The selected database engine is not implemented.");
  const path = env.MODEL_CONFIG_DATABASE_PATH || (env.NODE_ENV !== "production" ? "./var/data/intellitrex.sqlite" : "");
  if (!path || (env.NODE_ENV === "production" && !isAbsolute(path))) {
    configurationError("Configure an absolute persistent database path for production.");
  }
  return Object.freeze({ engine, path: resolve(path) });
}

export function secret(name: string, env: NodeJS.ProcessEnv = process.env): Buffer {
  const value = env[name] || "";
  if (!/^[A-Za-z0-9+/]{43}=$/.test(value)) configurationError(`Configure ${name} with a base64-encoded 32-byte key.`);
  const decoded = Buffer.from(value, "base64");
  if (decoded.length !== 32 || decoded.toString("base64") !== value) configurationError(`Invalid ${name}.`);
  return decoded;
}

export function encryptionKey() { return secret("MODEL_CONFIG_ENCRYPTION_KEY"); }

export function operatorConfig() {
  const hash = process.env.MODEL_SETTINGS_ADMIN_PASSWORD_HASH || "";
  if (!/^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(hash)) configurationError("Complete the Model Settings operator setup before signing in.");
  return Object.freeze({ passwordHash: hash, signingKey: secret("MODEL_SETTINGS_SESSION_SECRET") });
}
