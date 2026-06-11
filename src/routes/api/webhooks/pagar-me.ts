import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "node:crypto";
import { getServerConfig } from "@/lib/config.server";
import { rateLimit } from "@/lib/rate-limit.server";
import {
  saveWebhookEvent,
  processWebhookEventInternal,
} from "@/modules/billing/webhook-processor.server";

export const Route = createFileRoute("/api/webhooks/pagar-me")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
        if (!rateLimit(ip)) return new Response("Too Many Requests", { status: 429 });

        const { pagarMe } = getServerConfig();
        const rawBody = await request.text();

        if (pagarMe.webhookSecret) {
          const signature = request.headers.get("x-hub-signature") ?? "";
          const expected = createHash("sha256")
            .update(`${pagarMe.webhookSecret}${rawBody}`)
            .digest("hex");
          if (signature && signature !== expected) {
            return new Response("Invalid signature", { status: 401 });
          }
        }

        let payload: unknown;
        try {
          payload = JSON.parse(rawBody);
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const body = payload as Record<string, unknown>;
        const data = (body.data ?? body) as Record<string, unknown>;
        const metadata = (data.metadata ?? {}) as Record<string, unknown>;
        const clientId = metadata.client_id ? String(metadata.client_id) : null;
        const eventId = String(data.id ?? body.id ?? createHash("sha256").update(rawBody).digest("hex").slice(0, 32));
        const eventType = String(body.type ?? body.event ?? "charge.updated");

        const { id } = await saveWebhookEvent({
          provider: "pagar_me",
          eventId,
          eventType,
          clientId: clientId ?? undefined,
          payload,
        });

        try {
          await processWebhookEventInternal(id);
        } catch (err) {
          console.error("[webhook/pagar-me] processing error:", err);
        }

        return new Response("OK", { status: 200 });
      },
    },
  },
});
