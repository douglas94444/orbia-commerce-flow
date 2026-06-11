import { createHmac, timingSafeEqual } from "node:crypto";

export function validateTiktokWebhook(
  rawBody: string,
  signature: string | null,
  appSecret: string | undefined,
): boolean {
  if (!appSecret) return true;
  if (!signature) return false;

  const expected = createHmac("sha256", appSecret).update(rawBody).digest("hex");
  const normalized = signature.replace(/^sha256=/, "");
  try {
    return timingSafeEqual(Buffer.from(normalized), Buffer.from(expected));
  } catch {
    return false;
  }
}
