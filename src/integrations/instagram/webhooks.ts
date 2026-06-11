import { createHmac, timingSafeEqual } from "node:crypto";

export function validateInstagramWebhook(
  rawBody: string,
  signature: string | null,
  appSecret: string | undefined,
): boolean {
  if (!appSecret) return true;
  if (!signature) return false;

  const expected = "sha256=" + createHmac("sha256", appSecret).update(rawBody).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}
