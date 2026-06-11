import { createFileRoute } from "@tanstack/react-router";
import { parseWhatsAppWebhook, parseInboundMessages } from "@/integrations/whatsapp";
import { updateWhatsAppExecutionStatus } from "@/modules/retention/automation-engine.server";
import { handleInboundWhatsApp } from "@/modules/retention/whatsapp-compliance.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getServerConfig } from "@/lib/config.server";
import { rateLimit } from "@/lib/rate-limit.server";

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
        const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
        if (!rateLimit(ip)) return new Response("Too Many Requests", { status: 429 });

        const rawBody = await request.text();
        const { meta } = getServerConfig();
        const signature = request.headers.get("x-hub-signature-256");

        if (!meta.appSecret) return new Response("Server misconfiguration", { status: 503 });
        if (!signature) return new Response("Forbidden", { status: 403 });

        const { createHmac, timingSafeEqual } = await import("node:crypto");
        const expected =
          "sha256=" + createHmac("sha256", meta.appSecret).update(rawBody).digest("hex");
        try {
          if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected)))
            return new Response("Invalid signature", { status: 401 });
        } catch {
          return new Response("Invalid signature", { status: 401 });
        }

        let payload: unknown;
        try {
          payload = JSON.parse(rawBody);
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const updates = parseWhatsAppWebhook(payload);
        const inbound = parseInboundMessages(payload);

        for (const u of updates) {
          if (u.status === "sent") continue;
          const mapped = u.status === "read" ? "read" : u.status;
          if (mapped === "delivered" || mapped === "read" || mapped === "failed") {
            await updateWhatsAppExecutionStatus(u.messageId, mapped);
          }
        }

        for (const msg of inbound) {
          const { data: connections } = await supabaseAdmin
            .from("oauth_connections")
            .select("client_id")
            .eq("provider", "whatsapp")
            .eq("is_active", true)
            .limit(1);
          const clientId = connections?.[0]?.client_id;
          if (clientId && msg.text) {
            await handleInboundWhatsApp({ clientId, from: msg.from, text: msg.text });
          }
        }

        return new Response("OK", { status: 200 });
      },
    },
  },
});
