import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "node:crypto";
import { getServerConfig } from "@/lib/config.server";
import { rateLimit } from "@/lib/rate-limit.server";
import { validateMelhorEnvioWebhook } from "@/integrations/melhor-envio/client";
import {
  saveWebhookEvent,
  processWebhookEventInternal,
} from "@/modules/billing/webhook-processor.server";

export const Route = createFileRoute("/api/webhooks/melhor-envio")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
        if (!rateLimit(ip)) return new Response("Too Many Requests", { status: 429 });

        const rawBody = await request.text();
        const { melhorEnvio } = getServerConfig();
        const signature =
          request.headers.get("x-me-signature") ??
          request.headers.get("x-signature") ??
          request.headers.get("signature");

        if (
          melhorEnvio.clientSecret &&
          !validateMelhorEnvioWebhook(rawBody, signature, melhorEnvio.clientSecret)
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
        const eventId = String(
          body.id ?? body.tracking ?? createHash("sha256").update(rawBody).digest("hex").slice(0, 32),
        );
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
