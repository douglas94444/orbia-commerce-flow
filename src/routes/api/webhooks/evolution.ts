import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { handleInboundEvolution } from "@/modules/retention/whatsapp-compliance.server";
import { getServerConfig } from "@/lib/config.server";
import { rateLimit } from "@/lib/rate-limit.server";

export const Route = createFileRoute("/api/webhooks/evolution")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
        if (!rateLimit(ip)) return new Response("Too Many Requests", { status: 429 });

        const { evolution } = getServerConfig();
        const apiKey = request.headers.get("apikey") ?? request.headers.get("x-api-key");
        if (!evolution.apiKey || apiKey !== evolution.apiKey) {
          return new Response("Forbidden", { status: 403 });
        }

        let payload: Record<string, unknown>;
        try {
          payload = await request.json();
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const data = (payload.data ?? payload) as Record<string, unknown>;
        const key = data.key as Record<string, unknown> | undefined;
        const from = String(key?.remoteJid ?? data.from ?? "").replace(/\D/g, "");
        const message = data.message as Record<string, unknown> | undefined;
        const extended = message?.extendedTextMessage as Record<string, unknown> | undefined;
        const text = String(message?.conversation ?? extended?.text ?? data.text ?? "");

        if (!from || !text) return new Response("ok", { status: 200 });

        const instance = String(payload.instance ?? data.instance ?? "");
        let clientId: string | null = null;

        if (instance) {
          const { data: conns } = await supabaseAdmin
            .from("oauth_connections")
            .select("client_id, metadata")
            .eq("provider", "whatsapp")
            .eq("is_active", true);

          for (const c of conns ?? []) {
            const meta = (c.metadata ?? {}) as Record<string, unknown>;
            if (String(meta.evolution_instance ?? "") === instance) {
              clientId = c.client_id as string;
              break;
            }
          }
        }

        if (!clientId) {
          const { data: client } = await supabaseAdmin
            .from("clients")
            .select("id")
            .eq("whatsapp_provider", "evolution")
            .limit(1)
            .maybeSingle();
          clientId = client?.id ?? null;
        }

        if (clientId) {
          await handleInboundEvolution({ clientId, from, text });
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
