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
}

export async function getOrdersByChannel(clientId: string, days = 30): Promise<ChannelVolumeRow[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data: orders } = await supabaseAdmin
    .from("orders")
    .select("channel, value_cents, status, sla_deadline_at, updated_at")
    .eq("client_id", clientId)
    .gte("created_at", since.toISOString())
    .limit(2000);

  const byChannel = new Map<
    string,
    { count: number; gmv: number; slaTotal: number; slaOnTime: number }
  >();

  for (const o of orders ?? []) {
    const ch = o.channel as string;
    const cur = byChannel.get(ch) ?? { count: 0, gmv: 0, slaTotal: 0, slaOnTime: 0 };
    cur.count += 1;
    if (o.status !== "cancelado") cur.gmv += o.value_cents as number;
    if (o.status === "entregue" && o.sla_deadline_at) {
      cur.slaTotal += 1;
      const deadline = new Date(o.sla_deadline_at as string).getTime();
      const delivered = new Date(o.updated_at as string).getTime();
      if (delivered <= deadline) cur.slaOnTime += 1;
    }
    byChannel.set(ch, cur);
  }

  return [...byChannel.entries()]
    .map(([channel, v]) => ({
      channel,
      label: CHANNEL_LABEL[channel] ?? channel,
      orderCount: v.count,
      gmvCents: v.gmv,
      slaCompliancePercent:
        v.slaTotal > 0 ? Math.round((v.slaOnTime / v.slaTotal) * 100) : 100,
    }))
    .sort((a, b) => b.orderCount - a.orderCount);
}
