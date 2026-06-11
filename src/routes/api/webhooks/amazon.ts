import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "node:crypto";
import { parseAmazonSnsPayload, validateAmazonWebhook } from "@/integrations/amazon/webhooks";
import { getServerConfig } from "@/lib/config.server";
import { rateLimit } from "@/lib/rate-limit.server";
import {
  saveWebhookEvent,
  processWebhookEventInternal,
} from "@/modules/billing/webhook-processor.server";
import { resolveClientId } from "@/modules/logistics/order-ingestion.server";

export const Route = createFileRoute("/api/webhooks/amazon")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
        if (!rateLimit(ip)) return new Response("Too Many Requests", { status: 429 });

        const { amazon } = getServerConfig();
        const rawBody = await request.text();
        const signature =
          request.headers.get("x-amz-sns-signature") ??
          request.headers.get("x-amz-signature") ??
          request.headers.get("authorization");

        if (!validateAmazonWebhook(rawBody, signature, amazon.clientSecret)) {
          return new Response("Invalid signature", { status: 401 });
        }

        const parsed = parseAmazonSnsPayload(rawBody);
        if (parsed.kind === "subscription" && parsed.subscribeUrl) {
          await fetch(parsed.subscribeUrl).catch(() => undefined);
          return new Response("OK", { status: 200 });
        }

        const payload = parsed.payload;
        const body = payload as Record<string, unknown>;
        const orderPayload = (body.payload ?? body.Payload ?? body) as Record<string, unknown>;
        const amazonOrderId =
          orderPayload.AmazonOrderId ??
          orderPayload.amazon_order_id ??
          body.AmazonOrderId ??
          body.order_id;
        const sellerId = String(
          orderPayload.SellerId ??
            orderPayload.seller_id ??
            body.SellerId ??
            body.seller_id ??
            "",
        );

        const eventId = amazonOrderId
          ? `amazon-${String(amazonOrderId)}`
          : createHash("sha256").update(rawBody).digest("hex").slice(0, 32);
        const eventType = String(
          body.NotificationType ?? body.notification_type ?? "ORDER_CHANGE",
        );

        const clientId = sellerId ? await resolveClientId("amazon", sellerId) : null;

        const { id } = await saveWebhookEvent({
          provider: "amazon",
          eventId,
          eventType,
          clientId: clientId ?? undefined,
          payload,
        });

        try {
          await processWebhookEventInternal(id);
        } catch (err) {
          console.error("[webhook/amazon] processing error:", err);
        }

        return new Response("OK", { status: 200 });
      },
    },
  },
});
