import { decryptToken } from "@/lib/crypto.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logJob, startTimer } from "@/shared/lib/logger";

const GRAPH_BASE = "https://graph.facebook.com/v21.0";

interface MetaTemplate {
  name: string;
  language: string;
  status: string;
  category: string;
  id: string;
}

export async function syncWhatsAppTemplatesForClient(clientId: string): Promise<{ synced: number }> {
  const { data: conn } = await supabaseAdmin
    .from("oauth_connections")
    .select("access_token, metadata")
    .eq("client_id", clientId)
    .eq("provider", "whatsapp")
    .eq("is_active", true)
    .maybeSingle();

  if (!conn?.access_token) return { synced: 0 };

  const meta = (conn.metadata ?? {}) as Record<string, unknown>;
  const wabaId = String(meta.waba_id ?? meta.business_account_id ?? "");
  if (!wabaId) return { synced: 0 };

  const accessToken = decryptToken(conn.access_token);
  const res = await fetch(`${GRAPH_BASE}/${wabaId}/message_templates?limit=100`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) return { synced: 0 };

  const body = (await res.json()) as { data?: MetaTemplate[] };
  let synced = 0;

  for (const tpl of body.data ?? []) {
    await supabaseAdmin.from("whatsapp_templates").upsert(
      {
        client_id: clientId,
        name: tpl.name,
        language: tpl.language,
        status:
          tpl.status.toUpperCase() === "APPROVED"
            ? "approved"
            : tpl.status.toUpperCase() === "REJECTED"
              ? "rejected"
              : "pending",
        category: tpl.category,
        external_id: tpl.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "client_id,name,language" },
    );
    synced += 1;
  }

  return { synced };
}

export async function syncAllWhatsAppTemplates(): Promise<{ clients: number; synced: number }> {
  const end = startTimer();
  const { data: clients } = await supabaseAdmin
    .from("clients")
    .select("id")
    .eq("whatsapp_provider", "meta");

  let totalSynced = 0;
  for (const c of clients ?? []) {
    const { synced } = await syncWhatsAppTemplatesForClient(c.id);
    totalSynced += synced;
  }

  await logJob({
    job_type: "sync-whatsapp-templates",
    job_id: `wa-templates-${Date.now()}`,
    status: "completed",
    duration_ms: end(),
    metadata: { clients: clients?.length ?? 0, synced: totalSynced },
  });

  return { clients: clients?.length ?? 0, synced: totalSynced };
}
