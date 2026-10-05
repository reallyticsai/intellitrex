import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { AppError } from "./errors";

export function encryptCredential(value: string, key: Buffer): string {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return ["v1", nonce.toString("base64"), cipher.getAuthTag().toString("base64"), ciphertext.toString("base64")].join(".");
}

export function decryptCredential(envelope: string, key: Buffer): string {
  try {
    const [version, nonce, tag, ciphertext, extra] = envelope.split(".");
    if (version !== "v1" || !nonce || !tag || !ciphertext || extra !== undefined) throw new Error();
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(nonce, "base64"));
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64")), decipher.final()]).toString("utf8");
  } catch {
    throw new AppError("CREDENTIAL_UNREADABLE", "The saved API key could not be decrypted. Restore the matching encryption key or replace this credential.", 503);
  }
}
