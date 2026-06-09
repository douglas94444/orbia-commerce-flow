import { createFileRoute } from "@tanstack/react-router";
import { parseWhatsAppWebhook } from "@/integrations/whatsapp";
import { updateWhatsAppExecutionStatus } from "@/modules/retention/automation-engine.server";
import { getServerConfig } from "@/lib/config.server";

export const Route = createFileRoute("/api/webhooks/whatsapp")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge");
        const { whatsapp } = getServerConfig();

        if (mode === "subscribe" && token === whatsapp.verifyToken && challenge) {
          return new Response(challenge, { status: 200 });
        }
        return new Response("Forbidden", { status: 403 });
      },
      POST: async ({ request }) => {
        const payload = await request.json();
        const updates = parseWhatsAppWebhook(payload);

        for (const u of updates) {
          if (u.status === "sent") continue;
          const mapped = u.status === "read" ? "delivered" : u.status;
          if (mapped === "delivered" || mapped === "failed") {
            await updateWhatsAppExecutionStatus(u.messageId, mapped);
          }
        }

        return new Response("OK", { status: 200 });
      },
    },
  },
});
