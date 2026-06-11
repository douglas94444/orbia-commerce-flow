import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "node:crypto";
import { validateTiktokWebhook } from "@/integrations/tiktok/webhooks";
import { getServerConfig } from "@/lib/config.server";
import { rateLimit } from "@/lib/rate-limit.server";
import {
  saveWebhookEvent,
  processWebhookEventInternal,
} from "@/modules/billing/webhook-processor.server";
import { resolveClientId } from "@/modules/logistics/order-ingestion.server";

export const Route = createFileRoute("/api/webhooks/tiktok")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
        if (!rateLimit(ip)) return new Response("Too Many Requests", { status: 429 });

        const { tiktok } = getServerConfig();
        const rawBody = await request.text();
        const signature =
          request.headers.get("x-tts-signature") ??
          request.headers.get("x-tiktok-signature") ??
          request.headers.get("authorization");

        if (!validateTiktokWebhook(rawBody, signature, tiktok.appSecret)) {
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
        const orderId = data.order_id ?? data.id ?? data.order_sn;
        const shopId = String(data.shop_id ?? body.shop_id ?? data.seller_id ?? "");

        const eventId = orderId
          ? `tiktok-${String(orderId)}-${String(data.order_status ?? data.status ?? "update")}`
          : createHash("sha256").update(rawBody).digest("hex").slice(0, 32);
        const eventType = String(data.type ?? body.type ?? data.order_status ?? "order_update");

        const clientId = shopId ? await resolveClientId("tiktok", shopId) : null;

        const { id } = await saveWebhookEvent({
          provider: "tiktok",
          eventId,
          eventType,
          clientId: clientId ?? undefined,
          payload,
        });

        try {
          await processWebhookEventInternal(id);
        } catch (err) {
          console.error("[webhook/tiktok] processing error:", err);
        }

        return new Response("OK", { status: 200 });
      },
    },
  },
});
