import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendWhatsAppToClient } from "../notifications/whatsapp-alerts.server";

export async function computeSlaDeadline(channel: string): Promise<string | null> {
  const { data: rule } = await supabaseAdmin
    .from("channel_sla_rules")
    .select("dispatch_hours")
    .eq("channel", channel)
    .maybeSingle();

  if (!rule) return null;

  const deadline = new Date();
  deadline.setHours(deadline.getHours() + (rule.dispatch_hours as number));
  return deadline.toISOString();
}

export async function checkSlaAlerts(): Promise<{ warned: number; breached: number }> {
  const now = new Date();
  let warned = 0;
  let breached = 0;

  const { data: rules } = await supabaseAdmin.from("channel_sla_rules").select("*");
  const ruleMap = new Map((rules ?? []).map((r: { channel: string; alert_hours_before: number }) => [r.channel, r]));

  const { data: orders } = await supabaseAdmin
    .from("orders")
    .select("id, client_id, channel, external_id, sla_deadline_at, sla_alert_sent, sla_breached, status")
    .in("status", ["aguardando_nf", "separacao", "em_picking", "em_packing"])
    .not("sla_deadline_at", "is", null);

  for (const order of orders ?? []) {
    const deadline = new Date(order.sla_deadline_at as string);
    const rule = ruleMap.get(order.channel as string) as { alert_hours_before: number } | undefined;
    const alertBefore = rule?.alert_hours_before ?? 4;
    const alertThreshold = new Date(deadline.getTime() - alertBefore * 60 * 60 * 1000);

    if (now > deadline && !order.sla_breached) {
      await supabaseAdmin
        .from("orders")
        .update({ sla_breached: true })
        .eq("id", order.id);

      await sendWhatsAppToClient(
        order.client_id as string,
        `ALERTA CRÍTICO: Pedido ${order.external_id} estourou o SLA de despacho (${order.channel}).`,
      );
      breached += 1;
    } else if (now >= alertThreshold && now < deadline && !order.sla_alert_sent) {
      await supabaseAdmin
        .from("orders")
        .update({ sla_alert_sent: true })
        .eq("id", order.id);

      await sendWhatsAppToClient(
        order.client_id as string,
        `Aviso SLA: Pedido ${order.external_id} deve ser despachado até ${deadline.toLocaleString("pt-BR")}.`,
      );
      warned += 1;
    }
  }

  return { warned, breached };
}

export async function getSlaDashboard(clientId?: string): Promise<{
  onTime: number;
  atRisk: number;
  breached: number;
  total: number;
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

  return { onTime, atRisk, breached, total: active.length };
}
