import { supabaseAdmin } from "@/integrations/supabase/client.server";

const CHANNEL_LABEL: Record<string, string> = {
  mercado_livre: "Mercado Livre",
  shopee: "Shopee",
  amazon: "Amazon",
  tiktok: "TikTok Shop",
  instagram: "Instagram",
  nuvemshop: "Nuvemshop",
  shopify: "Shopify",
};

export interface ChannelVolumeRow {
  channel: string;
  label: string;
  orderCount: number;
  gmvCents: number;
  slaCompliancePercent: number;
  averageTicketCents: number;
  cancelRatePercent: number;
  previousPeriodOrderCount: number;
  previousPeriodGmvCents: number;
  orderCountDeltaPercent: number;
  gmvDeltaPercent: number;
}

interface ChannelAggregate {
  count: number;
  cancelled: number;
  gmv: number;
  slaTotal: number;
  slaOnTime: number;
}

function aggregateOrders(
  orders: Array<{
    channel: string;
    value_cents: number;
    status: string;
    sla_deadline_at: string | null;
    updated_at: string;
  }> | null,
): Map<string, ChannelAggregate> {
  const byChannel = new Map<string, ChannelAggregate>();

  for (const o of orders ?? []) {
    const ch = o.channel;
    const cur = byChannel.get(ch) ?? { count: 0, cancelled: 0, gmv: 0, slaTotal: 0, slaOnTime: 0 };
    cur.count += 1;
    if (o.status === "cancelado") cur.cancelled += 1;
    if (o.status !== "cancelado") cur.gmv += o.value_cents;
    if (o.status === "entregue" && o.sla_deadline_at) {
      cur.slaTotal += 1;
      const deadline = new Date(o.sla_deadline_at).getTime();
      const delivered = new Date(o.updated_at).getTime();
      if (delivered <= deadline) cur.slaOnTime += 1;
    }
    byChannel.set(ch, cur);
  }

  return byChannel;
}

function pctDelta(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

export async function getOrdersByChannel(clientId: string, days = 30): Promise<ChannelVolumeRow[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const previousSince = new Date(since);
  previousSince.setDate(previousSince.getDate() - days);

  const [{ data: currentOrders }, { data: previousOrders }] = await Promise.all([
    supabaseAdmin
      .from("orders")
      .select("channel, value_cents, status, sla_deadline_at, updated_at")
      .eq("client_id", clientId)
      .gte("created_at", since.toISOString())
      .limit(2000),
    supabaseAdmin
      .from("orders")
      .select("channel, value_cents, status, sla_deadline_at, updated_at")
      .eq("client_id", clientId)
      .gte("created_at", previousSince.toISOString())
      .lt("created_at", since.toISOString())
      .limit(2000),
  ]);

  const current = aggregateOrders(currentOrders);
  const previous = aggregateOrders(previousOrders);
  const channels = new Set([...current.keys(), ...previous.keys()]);

  return [...channels]
    .map((channel) => {
      const cur = current.get(channel) ?? { count: 0, cancelled: 0, gmv: 0, slaTotal: 0, slaOnTime: 0 };
      const prev = previous.get(channel) ?? { count: 0, cancelled: 0, gmv: 0, slaTotal: 0, slaOnTime: 0 };
      const paidOrders = cur.count - cur.cancelled;

      return {
        channel,
        label: CHANNEL_LABEL[channel] ?? channel,
        orderCount: cur.count,
        gmvCents: cur.gmv,
        slaCompliancePercent:
          cur.slaTotal > 0 ? Math.round((cur.slaOnTime / cur.slaTotal) * 100) : 100,
        averageTicketCents: paidOrders > 0 ? Math.round(cur.gmv / paidOrders) : 0,
        cancelRatePercent: cur.count > 0 ? Math.round((cur.cancelled / cur.count) * 100) : 0,
        previousPeriodOrderCount: prev.count,
        previousPeriodGmvCents: prev.gmv,
        orderCountDeltaPercent: pctDelta(cur.count, prev.count),
        gmvDeltaPercent: pctDelta(cur.gmv, prev.gmv),
      };
    })
    .sort((a, b) => b.orderCount - a.orderCount);
}
