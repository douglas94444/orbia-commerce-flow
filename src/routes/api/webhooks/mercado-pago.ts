import { createFileRoute } from "@tanstack/react-router";
import { validateMercadoPagoSignature } from "@/integrations/mercado-pago";
import { handleMercadoPagoWebhook } from "@/modules/billing/mercado-pago.server";

export const Route = createFileRoute("/api/webhooks/mercado-pago")({
  server: {
    handlers: {
      POST: async ({ request }) => {
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
          console.warn("[webhook/mercado-pago] invalid signature");
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
