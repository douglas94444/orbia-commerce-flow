import { createHmac, timingSafeEqual } from "node:crypto";
import { getServerConfig } from "@/lib/config.server";
import { shopifyFetch } from "./client";

const WEBHOOK_TOPICS = ["orders/paid", "orders/updated", "orders/create"] as const;

export async function registerShopifyWebhooks(shop: string, accessToken: string): Promise<void> {
  const { appUrl } = getServerConfig();
  const address = `${appUrl}/api/webhooks/shopify`;

  for (const topic of WEBHOOK_TOPICS) {
    await shopifyFetch(shop, accessToken, "/webhooks.json", {
      method: "POST",
      body: JSON.stringify({
        webhook: { topic, address, format: "json" },
      }),
    });
  }
}

export function validateShopifyWebhook(
  rawBody: string,
  signature: string | null,
  secret: string,
): boolean {
  if (!signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}
