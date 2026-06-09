import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { getServerConfig } from "./config.server";

const ALGO = "aes-256-gcm";
const ENCRYPTED_PREFIX_REGEX = /^[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/;

function getKey(): Buffer {
  const { tokenEncryptionKey } = getServerConfig();
  if (!tokenEncryptionKey) {
    // Dev fallback — never used when TOKEN_ENCRYPTION_KEY is set in production
    return createHash("sha256").update("orbia-dev-encryption-key").digest();
  }
  const buf = Buffer.from(tokenEncryptionKey, "hex");
  if (buf.length !== 32) throw new Error("TOKEN_ENCRYPTION_KEY must be 32 bytes (64 hex chars)");
  return buf;
}

export function encryptToken(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

// Safe to call on both encrypted and plaintext values — detects format automatically.
export function decryptToken(value: string): string {
  if (!ENCRYPTED_PREFIX_REGEX.test(value)) return value; // legacy plaintext
  const [ivHex, tagHex, dataHex] = value.split(":");
  const key = getKey();
  const decipher = createDecipheriv(ALGO, key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataHex, "hex")),
    decipher.final(),
  ]).toString("utf8");
}
