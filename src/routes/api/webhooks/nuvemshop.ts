import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "node:crypto";
import { getServerConfig } from "@/lib/config.server";
import { rateLimit } from "@/lib/rate-limit.server";
import { validateNuvemshopWebhook } from "@/integrations/nuvemshop";
import {
  saveWebhookEvent,
  processWebhookEventInternal,
} from "@/modules/billing/webhook-processor.server";
import { resolveClientId } from "@/modules/logistics/order-ingestion.server";

export const Route = createFileRoute("/api/webhooks/nuvemshop")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
        if (!rateLimit(ip)) return new Response("Too Many Requests", { status: 429 });

        const { nuvemshop } = getServerConfig();
        if (!nuvemshop.clientSecret) {
          return new Response("Nuvemshop not configured", { status: 503 });
        }

        const rawBody = await request.text();
        const signature =
          request.headers.get("x-linkedstore-hmac-sha256") ??
          request.headers.get("HTTP_X_LINKEDSTORE_HMAC_SHA256");

        if (!validateNuvemshopWebhook(rawBody, signature, nuvemshop.clientSecret)) {
          return new Response("Invalid signature", { status: 401 });
        }

        const eventId =
          request.headers.get("x-linkedstore-webhook-id") ??
          request.headers.get("x-linkedstore-event-id") ??
          createHash("sha256").update(rawBody).digest("hex").slice(0, 32);

        const eventType =
          request.headers.get("x-linkedstore-topic") ??
          request.headers.get("x-linkedstore-event") ??
          "order/updated";

        let payload: unknown;
        try {
          payload = JSON.parse(rawBody);
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const storeId = String((payload as Record<string, unknown>).store_id ?? "");
        const clientId = storeId ? await resolveClientId("nuvemshop", storeId) : null;

        const { id } = await saveWebhookEvent({
          provider: "nuvemshop",
          eventId,
          eventType,
          clientId: clientId ?? undefined,
          payload,
        });

        try {
          await processWebhookEventInternal(id);
        } catch (err) {
          console.error("[webhook/nuvemshop] processing error:", err);
        }

        return new Response("OK", { status: 200 });
      },
    },
  },
});
