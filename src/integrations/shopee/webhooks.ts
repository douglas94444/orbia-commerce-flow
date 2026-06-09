import { createHmac, timingSafeEqual } from "node:crypto";
import { getServerConfig } from "@/lib/config.server";

export function validateShopeeWebhook(
  rawBody: string,
  signature: string | null,
  url: string,
): boolean {
  const { shopee } = getServerConfig();
  if (!shopee.partnerKey) return true;
  if (!signature) return false;
  const base = `${url}|${rawBody}`;
  const expected = createHmac("sha256", shopee.partnerKey ?? "").update(base).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function registerShopeeWebhooks(
  _shopId: string,
  _accessToken: string,
): Promise<void> {
  // Shopee webhooks configured in Partner Center — document APP_URL in dashboard
}
