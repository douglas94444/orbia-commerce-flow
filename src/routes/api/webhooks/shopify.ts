import { createFileRoute } from "@tanstack/react-router";
import { getServerConfig } from "@/lib/config.server";
import { validateShopifyWebhook } from "@/integrations/shopify";
import {
  saveWebhookEvent,
  processWebhookEventInternal,
} from "@/modules/billing/webhook-processor.server";
import { resolveClientId } from "@/modules/logistics/order-ingestion.server";

export const Route = createFileRoute("/api/webhooks/shopify")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { shopify } = getServerConfig();
        if (!shopify.clientSecret) {
          return new Response("Shopify not configured", { status: 503 });
        }

        const rawBody = await request.text();
        const signature = request.headers.get("x-shopify-hmac-sha256");

        if (!validateShopifyWebhook(rawBody, signature, shopify.clientSecret)) {
          return new Response("Invalid signature", { status: 401 });
        }

        const eventId = request.headers.get("x-shopify-webhook-id") ?? `sh-${Date.now()}`;
        const eventType = request.headers.get("x-shopify-topic") ?? "orders/updated";
        const shop = request.headers.get("x-shopify-shop-domain") ?? "";

        let payload: unknown;
        try {
          payload = JSON.parse(rawBody);
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const clientId = shop ? await resolveClientId("shopify", shop) : null;

        const { id } = await saveWebhookEvent({
          provider: "shopify",
          eventId,
          eventType,
          clientId: clientId ?? undefined,
          payload,
        });

        try {
          await processWebhookEventInternal(id);
        } catch (err) {
          console.error("[webhook/shopify] processing error:", err);
        }

        return new Response("OK", { status: 200 });
      },
    },
  },
});
