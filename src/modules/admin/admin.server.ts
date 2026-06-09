import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const DEFAULT_ONBOARDING_TASKS: Array<{ week: number; task_key: string; title: string }> = [
  { week: 1, task_key: "oauth_connect", title: "Conectar canais de venda" },
  { week: 1, task_key: "fiscal_config", title: "Configurar dados fiscais" },
  { week: 1, task_key: "team_invite", title: "Convidar equipe do lojista" },
  { week: 1, task_key: "portal_walkthrough", title: "Tour do portal lojista" },
  { week: 2, task_key: "catalog_sync", title: "Sincronizar catálogo" },
  { week: 2, task_key: "meta_connect", title: "Conectar Meta Ads" },
  { week: 2, task_key: "google_connect", title: "Conectar Google Ads" },
  { week: 2, task_key: "first_campaign", title: "Primeira campanha ativa" },
  { week: 3, task_key: "logistics_webhook", title: "Webhooks de pedidos OK" },
  { week: 3, task_key: "test_order", title: "Pedido teste processado" },
  { week: 3, task_key: "nfe_test", title: "NF-e de teste autorizada" },
  { week: 3, task_key: "shipping_connect", title: "Melhor Envio conectado" },
  { week: 4, task_key: "automation_flow", title: "Fluxo de retenção ativo" },
  { week: 4, task_key: "whatsapp_connect", title: "WhatsApp Business conectado" },
  { week: 4, task_key: "billing_setup", title: "Assinatura Orbia ativa" },
  { week: 4, task_key: "qbr_schedule", title: "QBR inicial agendada" },
];

export async function ensureOnboardingTasks(clientId: string): Promise<void> {
  for (const task of DEFAULT_ONBOARDING_TASKS) {
    const { data: existing } = await supabaseAdmin
      .from("onboarding_tasks")
      .select("id")
      .eq("client_id", clientId)
      .eq("week", task.week)
      .eq("task_key", task.task_key)
      .maybeSingle();

    if (!existing) {
      await supabaseAdmin.from("onboarding_tasks").insert({
        client_id: clientId,
        week: task.week,
        task_key: task.task_key,
        title: task.title,
      });
    }
  }
}

export async function refreshClientLastContact(clientId: string): Promise<void> {
  await supabaseAdmin.rpc("refresh_client_last_contact", { p_client_id: clientId });
}

export async function maybeAdvanceOnboardingWeek(clientId: string, week: number): Promise<void> {
  const { data: tasks } = await supabaseAdmin
    .from("onboarding_tasks")
    .select("is_done")
    .eq("client_id", clientId)
    .eq("week", week);

  const allDone = (tasks ?? []).length > 0 && (tasks ?? []).every((t) => t.is_done);
  if (!allDone || week >= 4) return;

  const { data: client } = await supabaseAdmin
    .from("clients")
    .select("onboarding_week")
    .eq("id", clientId)
    .single();

  if (client && client.onboarding_week === week) {
    await supabaseAdmin
      .from("clients")
      .update({ onboarding_week: week + 1, updated_at: new Date().toISOString() })
      .eq("id", clientId);
  }
}
