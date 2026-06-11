import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getServerConfig } from "@/lib/config.server";
import { rateLimit } from "@/lib/rate-limit.server";

export const Route = createFileRoute("/api/webhooks/resend")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
        if (!rateLimit(ip)) return new Response("Too Many Requests", { status: 429 });

        const rawBody = await request.text();
        const { resend } = getServerConfig();

        const svixId = request.headers.get("svix-id");
        if (!svixId && !resend.apiKey) {
          return new Response("Not configured", { status: 503 });
        }

        let payload: Record<string, unknown>;
        try {
          payload = JSON.parse(rawBody);
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const type = String(payload.type ?? "");
        const data = (payload.data ?? {}) as Record<string, unknown>;
        const emailId = String(data.email_id ?? data.id ?? "");

        if (!emailId) return new Response("OK", { status: 200 });

        const statusMap: Record<string, string> = {
          "email.opened": "opened",
          "email.clicked": "clicked",
          "email.delivered": "delivered",
          "email.bounced": "failed",
        };
        const mapped = statusMap[type];
        if (!mapped) return new Response("OK", { status: 200 });

        const { data: log } = await supabaseAdmin
          .from("message_delivery_log")
          .select("id")
          .eq("provider_message_id", emailId)
          .maybeSingle();

        if (log) {
          const update: Record<string, unknown> = { status: mapped };
          if (mapped === "opened") update.opened_at = new Date().toISOString();
          if (mapped === "clicked") update.clicked_at = new Date().toISOString();
          await supabaseAdmin.from("message_delivery_log").update(update).eq("id", log.id);
        }

        return new Response("OK", { status: 200 });
      },
    },
  },
});
