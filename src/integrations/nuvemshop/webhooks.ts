import { createHmac, timingSafeEqual } from "node:crypto";
import { getServerConfig } from "@/lib/config.server";
import { nuvemshopFetch } from "./client";

const WEBHOOK_EVENTS = ["order/paid", "order/updated", "order/created"] as const;

export async function registerNuvemshopWebhooks(
  storeId: string,
  accessToken: string,
): Promise<void> {
  const { appUrl } = getServerConfig();
  const url = `${appUrl}/api/webhooks/nuvemshop`;

  for (const event of WEBHOOK_EVENTS) {
    await nuvemshopFetch(storeId, accessToken, "/webhooks", {
      method: "POST",
      body: JSON.stringify({ event, url }),
    });
  }
}

export function validateNuvemshopWebhook(
  rawBody: string,
  signature: string | null,
  secret: string,
): boolean {
  if (!signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}
