import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function checkMarketplacePenalties(): Promise<{
  missingTracking: number;
  nearDeadlineNoNf: number;
  alertsCreated: number;
}> {
  const now = Date.now();
  let missingTracking = 0;
  let nearDeadlineNoNf = 0;
  let alertsCreated = 0;

  const { data: rules } = await supabaseAdmin
    .from("channel_sla_rules")
    .select("channel, tracking_deadline_hours, penalty_description, dispatch_hours")
    .is("client_id", null)
    .not("tracking_deadline_hours", "is", null);

  const ruleMap = new Map((rules ?? []).map((r) => [r.channel as string, r]));

  const { data: dispatchedNoTracking } = await supabaseAdmin
    .from("orders")
    .select("id, client_id, external_id, channel, updated_at, metadata")
    .eq("status", "despachado")
    .is("tracking_code", null)
    .limit(100);

  for (const order of dispatchedNoTracking ?? []) {
    const rule = ruleMap.get(order.channel as string);
    if (!rule?.tracking_deadline_hours) continue;

    const hoursSince =
      (now - new Date(order.updated_at as string).getTime()) / 3_600_000;
    if (hoursSince < (rule.tracking_deadline_hours as number)) continue;

    const meta = (order.metadata ?? {}) as Record<string, unknown>;
    if (meta.penalty_tracking_alert_sent) continue;

    missingTracking += 1;
    await supabaseAdmin.from("operation_alerts").insert({
      client_id: order.client_id,
      kind: "sla",
      severity: "critical",
      title: "Risco penalidade marketplace",
      message: `Pedido ${order.external_id} (${order.channel}) sem tracking após ${Math.round(hoursSince)}h — ${rule.penalty_description ?? "penalidade possível"}`,
      is_resolved: false,
    });

    await supabaseAdmin
      .from("orders")
      .update({
        metadata: { ...meta, penalty_tracking_alert_sent: true },
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id);

    alertsCreated += 1;
  }

  const { data: wmsOrders } = await supabaseAdmin
    .from("orders")
    .select("id, client_id, external_id, channel, nf_status, sla_deadline_at, metadata")
    .in("status", ["aguardando_nf", "separacao", "em_picking", "em_packing"])
    .eq("nf_status", "pendente")
    .not("sla_deadline_at", "is", null)
    .limit(100);

  for (const order of wmsOrders ?? []) {
    const deadline = new Date(order.sla_deadline_at as string).getTime();
    const hoursLeft = (deadline - now) / 3_600_000;
    if (hoursLeft > 4 || hoursLeft < 0) continue;

    const meta = (order.metadata ?? {}) as Record<string, unknown>;
    if (meta.penalty_nf_alert_sent) continue;

    nearDeadlineNoNf += 1;
    await supabaseAdmin.from("operation_alerts").insert({
      client_id: order.client_id,
      kind: "sla",
      severity: "warning",
      title: "SLA em risco — NF pendente",
      message: `Pedido ${order.external_id} (${order.channel}) sem NF autorizada e prazo em ${Math.round(hoursLeft)}h`,
      is_resolved: false,
    });

    await supabaseAdmin
      .from("orders")
      .update({
        metadata: { ...meta, penalty_nf_alert_sent: true },
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id);

    alertsCreated += 1;
  }

  return { missingTracking, nearDeadlineNoNf, alertsCreated };
}
