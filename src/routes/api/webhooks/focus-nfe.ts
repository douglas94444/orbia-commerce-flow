import { createFileRoute } from "@tanstack/react-router";
import { rateLimit } from "@/lib/rate-limit.server";
import { handleFocusWebhook } from "@/modules/fiscal/focus-webhook.server";
import type { FocusWebhookPayload } from "@/modules/fiscal/focus-webhook.server";

export const Route = createFileRoute("/api/webhooks/focus-nfe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
        if (!rateLimit(ip)) return new Response("Too Many Requests", { status: 429 });

        const rawBody = await request.text();
        let payload: FocusWebhookPayload;
        try {
          payload = JSON.parse(rawBody) as FocusWebhookPayload;
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const signature =
          request.headers.get("x-focus-signature") ??
          request.headers.get("x-hub-signature-256");

        try {
          await handleFocusWebhook(rawBody, signature, payload);
        } catch (err) {
          const msg = (err as Error).message;
          if (msg.includes("signature")) return new Response("Unauthorized", { status: 401 });
          console.error("[webhook/focus-nfe] error:", err);
        }

        return new Response("OK", { status: 200 });
      },
    },
  },
});
