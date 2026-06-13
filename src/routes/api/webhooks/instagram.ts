import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "node:crypto";
import { getServerConfig } from "@/lib/config.server";
import { rateLimit } from "@/lib/rate-limit.server";
import { hardenInstagramOrderWebhook } from "@/modules/marketplaces/instagram-commerce.server";
import {
  saveWebhookEvent,
  processWebhookEventInternal,
} from "@/modules/billing/webhook-processor.server";
import { resolveClientId } from "@/modules/logistics/order-ingestion.server";

export const Route = createFileRoute("/api/webhooks/instagram")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge");
        const { meta } = getServerConfig();

        if (mode === "subscribe" && token === meta.appSecret && challenge) {
          return new Response(challenge, { status: 200 });
        }
        return new Response("Forbidden", { status: 403 });
      },
      POST: async ({ request }) => {
        const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
        if (!rateLimit(ip)) return new Response("Too Many Requests", { status: 429 });

        const { meta } = getServerConfig();
        const rawBody = await request.text();
        const signature = request.headers.get("x-hub-signature-256");

        const { valid, parsed } = hardenInstagramOrderWebhook(rawBody, signature);
        if (!valid || !parsed) {
          return new Response("Invalid signature", { status: 401 });
        }

        const payload = parsed;
        void meta;

        const body = payload as Record<string, unknown>;
        const entry = ((body.entry ?? []) as Array<Record<string, unknown>>)[0];
        const pageId = String(entry?.id ?? "");
        const changes = ((entry?.changes ?? []) as Array<Record<string, unknown>>)[0];
        const value = (changes?.value ?? {}) as Record<string, unknown>;
        const orderId = value.id ?? value.order_id;

        const eventId = orderId
          ? `instagram-${String(orderId)}`
          : createHash("sha256").update(rawBody).digest("hex").slice(0, 32);
        const eventType = String(changes?.field ?? "orders");

        const clientId = pageId ? await resolveClientId("instagram", pageId) : null;

        const { id } = await saveWebhookEvent({
          provider: "instagram",
          eventId,
          eventType,
          clientId: clientId ?? undefined,
          payload,
        });

        try {
          await processWebhookEventInternal(id);
        } catch (err) {
          console.error("[webhook/instagram] processing error:", err);
        }

        return new Response("OK", { status: 200 });
      },
    },
  },
});
