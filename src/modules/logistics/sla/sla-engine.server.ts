import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { notifyCsOnSlaBreach } from "@/modules/admin/cs-events.server";
import {
  sendWhatsAppToClient,
  sendWhatsAppToOrbiaOps,
} from "../notifications/whatsapp-alerts.server";

const WMS_STATUSES = new Set([
  "aguardando_nf",
  "separacao",
  "em_picking",
  "em_packing",
]);

export interface ChannelSlaRule {
  id: string;
  channel: string;
  clientId: string | null;
  dispatchHours: number;
  alertHoursBefore: number;
  trackingDeadlineHours: number | null;
  penaltyDescription: string | null;
}

export interface SlaOrderRow {
  orderId: string;
  externalId: string;
  channel: string;
  city: string | null;
  status: string;
  slaDeadlineAt: string;
  slaAlertSent: boolean;
  slaBreached: boolean;
  bucket: "on_time" | "at_risk" | "breached";
}

export async function getChannelSlaRule(
  channel: string,
  clientId?: string,
): Promise<{ dispatch_hours: number; alert_hours_before: number } | null> {
  if (clientId) {
    const { data: clientRule } = await supabaseAdmin
      .from("channel_sla_rules")
      .select("dispatch_hours, alert_hours_before")
      .eq("channel", channel)
      .eq("client_id", clientId)
      .maybeSingle();
    if (clientRule) return clientRule;
  }

  const { data: rule } = await supabaseAdmin
    .from("channel_sla_rules")
    .select("dispatch_hours, alert_hours_before")
    .eq("channel", channel)
    .is("client_id", null)
    .maybeSingle();

  return rule;
}

export async function computeSlaDeadline(
  channel: string,
  clientId?: string,
): Promise<string | null> {
  const rule = await getChannelSlaRule(channel, clientId);
  if (!rule) return null;

  const deadline = new Date();
  deadline.setHours(deadline.getHours() + (rule.dispatch_hours as number));
  return deadline.toISOString();
}

export async function listChannelSlaRules(clientId?: string): Promise<ChannelSlaRule[]> {
  let query = supabaseAdmin
    .from("channel_sla_rules")
    .select(
      "id, channel, client_id, dispatch_hours, alert_hours_before, tracking_deadline_hours, penalty_description",
    )
    .order("channel");

  if (clientId) {
    query = query.or(`client_id.is.null,client_id.eq.${clientId}`);
  } else {
    query = query.is("client_id", null);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data ?? []).map((r) => ({
    id: r.id as string,
    channel: r.channel as string,
    clientId: (r.client_id as string | null) ?? null,
    dispatchHours: r.dispatch_hours as number,
    alertHoursBefore: r.alert_hours_before as number,
    trackingDeadlineHours: (r.tracking_deadline_hours as number | null) ?? null,
    penaltyDescription: (r.penalty_description as string | null) ?? null,
  }));
}

export async function upsertChannelSlaRule(input: {
  channel: string;
  dispatchHours: number;
  alertHoursBefore: number;
  clientId?: string | null;
  trackingDeadlineHours?: number | null;
  penaltyDescription?: string | null;
}): Promise<void> {
  const row = {
    channel: input.channel,
    dispatch_hours: input.dispatchHours,
    alert_hours_before: input.alertHoursBefore,
    client_id: input.clientId ?? null,
    tracking_deadline_hours: input.trackingDeadlineHours ?? null,
    penalty_description: input.penaltyDescription ?? null,
  };

  if (input.clientId) {
    const { data: existing } = await supabaseAdmin
      .from("channel_sla_rules")
      .select("id")
      .eq("channel", input.channel)
      .eq("client_id", input.clientId)
      .maybeSingle();

    if (existing) {
      const { error } = await supabaseAdmin
        .from("channel_sla_rules")
        .update(row)
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
      return;
    }
    const { error } = await supabaseAdmin.from("channel_sla_rules").insert(row);
    if (error) throw new Error(error.message);
    return;
  }

  const { data: existing } = await supabaseAdmin
    .from("channel_sla_rules")
    .select("id")
    .eq("channel", input.channel)
    .is("client_id", null)
    .maybeSingle();

  if (existing) {
    const { error } = await supabaseAdmin.from("channel_sla_rules").update(row).eq("id", existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabaseAdmin.from("channel_sla_rules").insert(row);
    if (error) throw new Error(error.message);
  }
}

function classifySlaBucket(
  order: { sla_breached: boolean; sla_alert_sent: boolean },
  now: Date,
  deadline: Date,
  alertBefore: number,
): SlaOrderRow["bucket"] {
  if (order.sla_breached || now > deadline) return "breached";
  const alertThreshold = new Date(deadline.getTime() - alertBefore * 60 * 60 * 1000);
  if (now >= alertThreshold || order.sla_alert_sent) return "at_risk";
  return "on_time";
}

export async function listSlaAtRiskOrders(
  clientId: string,
  bucketFilter?: SlaOrderRow["bucket"],
): Promise<SlaOrderRow[]> {
  const { data: rules } = await supabaseAdmin.from("channel_sla_rules").select("*");
  const ruleMap = new Map(
    (rules ?? []).map((r: { channel: string; alert_hours_before: number }) => [r.channel, r]),
  );

  const { data: orders, error } = await supabaseAdmin
    .from("orders")
    .select(
      "id, external_id, channel, city, status, sla_deadline_at, sla_alert_sent, sla_breached",
    )
    .eq("client_id", clientId)
    .in("status", [...WMS_STATUSES])
    .not("sla_deadline_at", "is", null)
    .order("sla_deadline_at", { ascending: true })
    .limit(200);

  if (error) throw new Error(error.message);

  const now = new Date();
  const rows: SlaOrderRow[] = [];

  for (const o of orders ?? []) {
    const deadline = new Date(o.sla_deadline_at as string);
    const rule = ruleMap.get(o.channel as string) as { alert_hours_before: number } | undefined;
    const alertBefore = rule?.alert_hours_before ?? 4;
    const bucket = classifySlaBucket(
      { sla_breached: o.sla_breached as boolean, sla_alert_sent: o.sla_alert_sent as boolean },
      now,
      deadline,
      alertBefore,
    );
    if (bucketFilter && bucket !== bucketFilter) continue;
    rows.push({
      orderId: o.id as string,
      externalId: o.external_id as string,
      channel: o.channel as string,
      city: o.city as string | null,
      status: o.status as string,
      slaDeadlineAt: o.sla_deadline_at as string,
      slaAlertSent: o.sla_alert_sent as boolean,
      slaBreached: o.sla_breached as boolean,
      bucket,
    });
  }

  return rows;
}

export async function checkSlaAlerts(): Promise<{ warned: number; breached: number }> {
  const now = new Date();
  let warned = 0;
  let breached = 0;
  let offset = 0;
  const batch = 100;

  const { data: rules } = await supabaseAdmin.from("channel_sla_rules").select("*");
  const ruleMap = new Map(
    (rules ?? []).map((r: { channel: string; alert_hours_before: number }) => [r.channel, r]),
  );

  while (true) {
    const { data: orders } = await supabaseAdmin
      .from("orders")
      .select("id, client_id, channel, external_id, sla_deadline_at, sla_alert_sent, sla_breached, status")
      .in("status", [...WMS_STATUSES])
      .not("sla_deadline_at", "is", null)
      .range(offset, offset + batch - 1);

    if (!orders?.length) break;

    for (const order of orders) {
      const deadline = new Date(order.sla_deadline_at as string);
      const rule = ruleMap.get(order.channel as string) as { alert_hours_before: number } | undefined;
      const alertBefore = rule?.alert_hours_before ?? 4;
      const alertThreshold = new Date(deadline.getTime() - alertBefore * 60 * 60 * 1000);

      if (now > deadline && !order.sla_breached) {
        await supabaseAdmin.from("orders").update({ sla_breached: true }).eq("id", order.id);

        const msg = `ALERTA CRÍTICO: Pedido ${order.external_id} estourou o SLA de despacho (${order.channel}).`;
        await sendWhatsAppToClient(order.client_id as string, msg);
        await sendWhatsAppToOrbiaOps(
          `[Orbia Ops] SLA estourado — pedido ${order.external_id} (${order.channel})`,
        );

        await supabaseAdmin.from("operation_alerts").insert({
          client_id: order.client_id,
          kind: "sla",
          severity: "critical",
          title: "SLA de despacho estourado",
          message: `Pedido ${order.external_id} (${order.channel}) passou do prazo de despacho.`,
          is_resolved: false,
        });

        await notifyCsOnSlaBreach(
          order.id as string,
          order.client_id as string,
          order.external_id as string,
        );
        breached += 1;
      } else if (now >= alertThreshold && now < deadline && !order.sla_alert_sent) {
        await supabaseAdmin.from("orders").update({ sla_alert_sent: true }).eq("id", order.id);

        await sendWhatsAppToClient(
          order.client_id as string,
          `Aviso SLA: Pedido ${order.external_id} deve ser despachado até ${deadline.toLocaleString("pt-BR")}.`,
        );
        warned += 1;
      }
    }

    if (orders.length < batch) break;
    offset += batch;
  }

  return { warned, breached };
}

export async function getSlaDashboard(clientId?: string): Promise<{
  onTime: number;
  atRisk: number;
  breached: number;
  total: number;
  compliancePercent: number;
}> {
  let query = supabaseAdmin
    .from("orders")
    .select("sla_breached, sla_alert_sent, status")
    .not("sla_deadline_at", "is", null);

  if (clientId) query = query.eq("client_id", clientId);

  const { data: orders } = await query;
  const active = (orders ?? []).filter(
    (o: { status: string }) => !["entregue", "cancelado", "devolvido"].includes(o.status),
  );

  const breached = active.filter((o: { sla_breached: boolean }) => o.sla_breached).length;
  const atRisk = active.filter(
    (o: { sla_breached: boolean; sla_alert_sent: boolean }) => o.sla_alert_sent && !o.sla_breached,
  ).length;
  const onTime = active.length - breached - atRisk;
  const total = active.length;
  const compliancePercent =
    total > 0 ? Math.round(((onTime + atRisk) / total) * 100) : 100;

  return { onTime, atRisk, breached, total, compliancePercent };
}

export async function getDispatchSlaCompliancePercent(clientId: string): Promise<number> {
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: dispatched } = await supabaseAdmin
    .from("orders")
    .select("metadata, sla_deadline_at")
    .eq("client_id", clientId)
    .in("status", ["despachado", "em_transito", "entregue"])
    .gte("updated_at", since30d)
    .not("sla_deadline_at", "is", null)
    .limit(500);

  if (!dispatched?.length) return 100;

  let met = 0;
  for (const o of dispatched) {
    const meta = (o.metadata ?? {}) as Record<string, unknown>;
    if (meta.sla_met === true) met += 1;
    else if (meta.sla_met === false) continue;
    else if (o.sla_deadline_at && meta.sla_dispatched_at) {
      if (new Date(meta.sla_dispatched_at as string) <= new Date(o.sla_deadline_at as string)) {
        met += 1;
      }
    }
  }

  return Math.round((met / dispatched.length) * 100);
}
