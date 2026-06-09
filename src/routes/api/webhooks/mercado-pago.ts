import { createFileRoute } from "@tanstack/react-router";
import { validateMercadoPagoSignature } from "@/integrations/mercado-pago";
import { handleMercadoPagoWebhook } from "@/modules/billing/mercado-pago.server";
import { rateLimit } from "@/lib/rate-limit.server";

export const Route = createFileRoute("/api/webhooks/mercado-pago")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
        if (!rateLimit(ip)) return new Response("Too Many Requests", { status: 429 });

        const rawBody = await request.text();
        let payload: Record<string, unknown>;
        try {
          payload = JSON.parse(rawBody) as Record<string, unknown>;
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const data = payload.data as Record<string, unknown> | undefined;
        const dataId = String(data?.id ?? "");
        const xSignature = request.headers.get("x-signature");
        const xRequestId = request.headers.get("x-request-id");

        if (!validateMercadoPagoSignature(xSignature, xRequestId, dataId)) {
          return new Response("Invalid signature", { status: 401 });
        }

        try {
          await handleMercadoPagoWebhook(payload);
        } catch (err) {
          console.error("[webhook/mercado-pago] processing error:", err);
        }

        return new Response("OK", { status: 200 });
      },
    },
  },
});
