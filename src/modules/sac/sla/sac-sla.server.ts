import { supabaseAdmin } from "@/integrations/supabase/client.server";

const DEFAULT_SLA: Record<string, { response: number; resolution: number }> = {
  whatsapp: { response: 120, resolution: 2880 },
  email: { response: 1440, resolution: 4320 },
  mercado_livre: { response: 720, resolution: 2880 },
  shopee: { response: 720, resolution: 2880 },
  amazon: { response: 720, resolution: 2880 },
  site_form: { response: 480, resolution: 2880 },
  chat: { response: 30, resolution: 1440 },
  instagram: { response: 240, resolution: 2880 },
};

export async function computeSlaDueDates(
  clientId: string,
  channel: string,
  category: string,
): Promise<{ responseDueAt: string; resolutionDueAt: string }> {
  const { data: policy } = await supabaseAdmin
    .from("sac_sla_policies")
    .select("response_minutes, resolution_minutes")
    .eq("client_id", clientId)
    .eq("channel", channel)
    .or(`category.eq.${category},category.is.null`)
    .order("category", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  const defaults = DEFAULT_SLA[channel] ?? { response: 480, resolution: 2880 };
  const responseMin = policy?.response_minutes ?? defaults.response;
  const resolutionMin = policy?.resolution_minutes ?? defaults.resolution;
  const now = Date.now();

  return {
    responseDueAt: new Date(now + responseMin * 60_000).toISOString(),
    resolutionDueAt: new Date(now + resolutionMin * 60_000).toISOString(),
  };
}

export async function checkSacSlaBreaches(): Promise<number> {
  const warningThreshold = new Date(Date.now() + 15 * 60_000).toISOString();
  const now = new Date().toISOString();

  const { data: atRisk } = await supabaseAdmin
    .from("sac_tickets")
    .select("id, client_id, protocol, channel, sla_response_due_at")
    .is("first_response_at", null)
    .in("status", ["open", "in_progress"])
    .lte("sla_response_due_at", warningThreshold)
    .gte("sla_response_due_at", now);

  let alerted = 0;
  for (const t of atRisk ?? []) {
    const { data: existing } = await supabaseAdmin
      .from("operation_alerts")
      .select("id")
      .eq("client_id", t.client_id)
      .eq("kind", "system")
      .ilike("title", `%${t.protocol}%`)
      .eq("is_resolved", false)
      .maybeSingle();

    if (existing) continue;

    await supabaseAdmin.from("operation_alerts").insert({
      client_id: t.client_id,
      kind: "system",
      severity: "warning",
      title: `SLA SAC próximo — ${t.protocol}`,
      message: `Ticket ${t.protocol} (${t.channel}) sem primeira resposta. Prazo: ${t.sla_response_due_at}`,
      is_resolved: false,
    });
    alerted++;
  }

  const { data: breached } = await supabaseAdmin
    .from("sac_tickets")
    .select("id, client_id, protocol")
    .is("first_response_at", null)
    .in("status", ["open", "in_progress"])
    .lt("sla_response_due_at", now);

  for (const t of breached ?? []) {
    await supabaseAdmin
      .from("sac_tickets")
      .update({ priority: "urgent" })
      .eq("id", t.id)
      .neq("priority", "critical");

    await emitEscalation(t.id, t.client_id, "sla_breach");
    alerted++;
  }

  return alerted;
}

async function emitEscalation(ticketId: string, clientId: string, reason: string): Promise<void> {
  const { emitDomainEvent } = await import("@/shared/lib/domain-events.server");
  await emitDomainEvent("sac.ticket.escalated", { ticketId, clientId, reason });
}

export async function canAgentTakeTicket(clientId: string, staffId: string): Promise<boolean> {
  const { data: capacity } = await supabaseAdmin
    .from("sac_agent_capacity")
    .select("max_concurrent_tickets")
    .eq("client_id", clientId)
    .eq("staff_id", staffId)
    .maybeSingle();

  const max = capacity?.max_concurrent_tickets ?? 10;

  const { count } = await supabaseAdmin
    .from("sac_tickets")
    .select("id", { count: "exact", head: true })
    .eq("assigned_to", staffId)
    .in("status", ["open", "in_progress", "waiting_customer"]);

  return (count ?? 0) < max;
}
