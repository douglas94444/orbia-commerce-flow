import { createHmac, timingSafeEqual } from "node:crypto";
import { getServerConfig } from "@/lib/config.server";
import { logIntegration, startTimer } from "@/shared/lib/logger";
import { shopeeFetch } from "./client";

export function validateShopeeWebhook(
  rawBody: string,
  signature: string | null,
  url: string,
): boolean {
  const { shopee } = getServerConfig();
  if (!shopee.partnerKey) throw new Error("SHOPEE_PARTNER_KEY not configured");
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
  shopId: string,
  accessToken: string,
): Promise<void> {
  const { appUrl } = getServerConfig();
  const callbackUrl = `${appUrl}/api/webhooks/shopee`;
  const end = startTimer();

  try {
    await shopeeFetch<{ error?: string }>(
      "/api/v2/push/set_push_config",
      shopId,
      accessToken,
      {
        method: "POST",
        body: JSON.stringify({
          push_config: {
            callback_url: callbackUrl,
            push_config_list: [
              { push_type: 1, callback_url: callbackUrl },
              { push_type: 2, callback_url: callbackUrl },
            ],
          },
        }),
      },
    );

    await logIntegration({
      provider: "shopee",
      operation: "register_webhooks",
      status: "success",
      duration_ms: end(),
      metadata: { shopId, callbackUrl },
    });
  } catch (err) {
    await logIntegration({
      provider: "shopee",
      operation: "register_webhooks",
      status: "error",
      duration_ms: end(),
      error_message: (err as Error).message,
      metadata: {
        shopId,
        callbackUrl,
        note:
          "Configure webhook URL manually in Shopee Partner Center if API registration fails",
      },
    });
  }
}
