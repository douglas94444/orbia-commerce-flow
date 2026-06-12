import { decryptToken } from "@/lib/crypto.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logIntegration, startTimer } from "@/shared/lib/logger";

const GRAPH_BASE = "https://graph.facebook.com/v21.0";

export async function submitWhatsAppTemplate(input: {
  clientId: string;
  name: string;
  language: string;
  category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
  bodyText: string;
}): Promise<{ externalId: string; status: string }> {
  const { data: conn } = await supabaseAdmin
    .from("oauth_connections")
    .select("access_token, metadata")
    .eq("client_id", input.clientId)
    .eq("provider", "whatsapp")
    .eq("is_active", true)
    .maybeSingle();

  if (!conn?.access_token) throw new Error("Conexão WhatsApp não encontrada");

  const meta = (conn.metadata ?? {}) as Record<string, unknown>;
  const wabaId = String(meta.waba_id ?? meta.business_account_id ?? "");
  if (!wabaId) throw new Error("WABA ID não configurado");

  const accessToken = decryptToken(conn.access_token);
  const end = startTimer();

  const res = await fetch(`${GRAPH_BASE}/${wabaId}/message_templates`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: input.name,
      language: input.language,
      category: input.category,
      components: [{ type: "BODY", text: input.bodyText }],
    }),
  });

  const body = (await res.json()) as Record<string, unknown>;
  await logIntegration({
    provider: "meta",
    operation: "submit_whatsapp_template",
    status: res.ok ? "success" : "error",
    response_code: res.status,
    duration_ms: end(),
    client_id: input.clientId,
    error_message: res.ok ? undefined : JSON.stringify(body).slice(0, 500),
  });

  if (!res.ok) throw new Error(String(body.error ?? JSON.stringify(body)).slice(0, 200));

  const externalId = String(body.id ?? "");
  const status = String(body.status ?? "PENDING").toLowerCase();

  await supabaseAdmin.from("whatsapp_templates").upsert(
    {
      client_id: input.clientId,
      name: input.name,
      language: input.language,
      status: status === "approved" ? "approved" : "pending",
      category: input.category,
      external_id: externalId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "client_id,name,language" },
  );

  return { externalId, status };
}
