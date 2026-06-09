import { createFileRoute } from "@tanstack/react-router";
import { validateMercadoLivreWebhook } from "@/integrations/mercado-livre";
import { getServerConfig } from "@/lib/config.server";
import {
  saveWebhookEvent,
  processWebhookEventInternal,
} from "@/modules/billing/webhook-processor.server";
import {
  enrichMercadoLivrePayload,
  resolveClientId,
} from "@/modules/logistics/order-ingestion.server";

export const Route = createFileRoute("/api/webhooks/mercado-livre")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { mercadoLivre } = getServerConfig();
        const rawBody = await request.text();
        const signature = request.headers.get("x-signature");
        const requestId = request.headers.get("x-request-id");

        if (
          mercadoLivre.clientSecret &&
          !validateMercadoLivreWebhook(rawBody, signature, mercadoLivre.clientSecret, requestId)
        ) {
          return new Response("Invalid signature", { status: 401 });
        }

        let payload: unknown;
        try {
          payload = JSON.parse(rawBody);
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const body = payload as Record<string, unknown>;
        const eventId = String(body._id ?? `ml-${Date.now()}`);
        const eventType = String(body.topic ?? "orders_v2");
        const userId = String(body.user_id ?? "");

        const clientId = userId ? await resolveClientId("mercado_livre", userId) : null;

        let enriched = payload;
        try {
          enriched = await enrichMercadoLivrePayload(payload);
        } catch (err) {
          console.error("[webhook/mercado-livre] enrich error:", err);
        }

        const { id } = await saveWebhookEvent({
          provider: "mercado_livre",
          eventId,
          eventType,
          clientId: clientId ?? undefined,
          payload: enriched,
        });

        try {
          await processWebhookEventInternal(id);
        } catch (err) {
          console.error("[webhook/mercado-livre] processing error:", err);
        }

        return new Response("OK", { status: 200 });
      },
    },
  },
});
