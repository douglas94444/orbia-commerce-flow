import { createFileRoute } from "@tanstack/react-router";
import {
  saveWebhookEvent,
  processWebhookEventInternal,
} from "@/modules/billing/webhook-processor.server";

export const Route = createFileRoute("/api/webhooks/melhor-envio")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawBody = await request.text();

        let payload: unknown;
        try {
          payload = JSON.parse(rawBody);
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const body = payload as Record<string, unknown>;
        const eventId = String(body.id ?? body.tracking ?? `me-${Date.now()}`);
        const eventType = String(body.event ?? body.status ?? "tracking_update");

        const { id } = await saveWebhookEvent({
          provider: "melhor_envio",
          eventId,
          eventType,
          payload,
        });

        try {
          await processWebhookEventInternal(id);
        } catch (err) {
          console.error("[webhook/melhor-envio] processing error:", err);
        }

        return new Response("OK", { status: 200 });
      },
    },
  },
});
