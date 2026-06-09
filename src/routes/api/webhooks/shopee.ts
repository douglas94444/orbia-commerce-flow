import { createFileRoute } from "@tanstack/react-router";
import { validateShopeeWebhook } from "@/integrations/shopee";
import { getServerConfig } from "@/lib/config.server";
import { rateLimit } from "@/lib/rate-limit.server";
import {
  saveWebhookEvent,
  processWebhookEventInternal,
} from "@/modules/billing/webhook-processor.server";
import { resolveClientId } from "@/modules/logistics/order-ingestion.server";

export const Route = createFileRoute("/api/webhooks/shopee")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
        if (!rateLimit(ip)) return new Response("Too Many Requests", { status: 429 });

        const { appUrl } = getServerConfig();
        const rawBody = await request.text();
        const signature = request.headers.get("authorization") ?? request.headers.get("x-shopee-signature");
        const webhookUrl = `${appUrl}/api/webhooks/shopee`;

        if (!validateShopeeWebhook(rawBody, signature, webhookUrl)) {
          return new Response("Invalid signature", { status: 401 });
        }

        let payload: unknown;
        try {
          payload = JSON.parse(rawBody);
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const body = payload as Record<string, unknown>;
        const data = (body.data ?? body) as Record<string, unknown>;
        const eventId = String(data.order_sn ?? data.ordersn ?? `shopee-${Date.now()}`);
        const eventType = String(body.code ?? body.type ?? "order_status_push");
        const shopId = String(data.shop_id ?? body.shop_id ?? "");

        const clientId = shopId ? await resolveClientId("shopee", shopId) : null;

        const { id } = await saveWebhookEvent({
          provider: "shopee",
          eventId: `${eventId}-${eventType}`,
          eventType,
          clientId: clientId ?? undefined,
          payload,
        });

        try {
          await processWebhookEventInternal(id);
        } catch (err) {
          console.error("[webhook/shopee] processing error:", err);
        }

        return new Response("OK", { status: 200 });
      },
    },
  },
});
