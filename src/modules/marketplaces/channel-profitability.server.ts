import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";

const DEFAULT_FEE_RATES: Record<string, number> = {
  mercado_livre: 0.16,
  shopee: 0.14,
  amazon: 0.15,
  tiktok: 0.08,
  nuvemshop: 0.03,
  shopify: 0.02,
  instagram: 0.05,
};

export interface ChannelProfitabilityRow {
  channel: string;
  gmvCents: number;
  feeCents: number;
  netRevenueCents: number;
  marginPercent: number;
  orderCount: number;
}

export interface ProductProfitabilityRow {
  sku: string;
  name: string;
  channel: string;
  gmvCents: number;
  feeCents: number;
  netRevenueCents: number;
  unitsSold: number;
}

function estimateFees(gmvCents: number, channel: string): number {
  const rate = DEFAULT_FEE_RATES[channel] ?? 0.1;
  return Math.round(gmvCents * rate);
}

export async function snapshotOrderFees(
  clientId: string,
  orderId: string,
  channel: string,
  gmvCents: number,
  metadata?: Record<string, unknown>,
): Promise<void> {
  const marketplaceFee =
    metadata?.marketplace_fee_cents != null
      ? Number(metadata.marketplace_fee_cents)
      : estimateFees(gmvCents, channel);
  const shippingFee = metadata?.shipping_fee_cents != null ? Number(metadata.shipping_fee_cents) : 0;
  const paymentFee = metadata?.payment_fee_cents != null ? Number(metadata.payment_fee_cents) : 0;
  const otherFee = metadata?.other_fee_cents != null ? Number(metadata.other_fee_cents) : 0;
  const totalFees = marketplaceFee + shippingFee + paymentFee + otherFee;
  const netRevenue = Math.max(0, gmvCents - totalFees);

  await supabaseAdmin.from("channel_fee_snapshots").upsert(
    {
      client_id: clientId,
      order_id: orderId,
      channel,
      gmv_cents: gmvCents,
      marketplace_fee_cents: marketplaceFee,
      shipping_fee_cents: shippingFee,
      payment_fee_cents: paymentFee,
      other_fee_cents: otherFee,
      net_revenue_cents: netRevenue,
      metadata: (metadata ?? {}) as Json,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "order_id" },
  );
}

export async function getChannelProfitability(
  clientId: string,
  days = 30,
): Promise<ChannelProfitabilityRow[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data: snapshots } = await supabaseAdmin
    .from("channel_fee_snapshots")
    .select("channel, gmv_cents, marketplace_fee_cents, shipping_fee_cents, payment_fee_cents, other_fee_cents, net_revenue_cents")
    .eq("client_id", clientId)
    .gte("created_at", since.toISOString());

  const byChannel = new Map<
    string,
    { gmv: number; fees: number; net: number; count: number }
  >();

  for (const row of snapshots ?? []) {
    const ch = row.channel as string;
    const fees =
      Number(row.marketplace_fee_cents ?? 0) +
      Number(row.shipping_fee_cents ?? 0) +
      Number(row.payment_fee_cents ?? 0) +
      Number(row.other_fee_cents ?? 0);
    const cur = byChannel.get(ch) ?? { gmv: 0, fees: 0, net: 0, count: 0 };
    cur.gmv += Number(row.gmv_cents ?? 0);
    cur.fees += fees;
    cur.net += Number(row.net_revenue_cents ?? 0);
    cur.count += 1;
    byChannel.set(ch, cur);
  }

  if (!byChannel.size) {
    const { data: orders } = await supabaseAdmin
      .from("orders")
      .select("channel, value_cents")
      .eq("client_id", clientId)
      .neq("status", "cancelado")
      .gte("created_at", since.toISOString());

    for (const o of orders ?? []) {
      const ch = o.channel as string;
      const gmv = Number(o.value_cents ?? 0);
      const fees = estimateFees(gmv, ch);
      const cur = byChannel.get(ch) ?? { gmv: 0, fees: 0, net: 0, count: 0 };
      cur.gmv += gmv;
      cur.fees += fees;
      cur.net += gmv - fees;
      cur.count += 1;
      byChannel.set(ch, cur);
    }
  }

  return [...byChannel.entries()]
    .map(([channel, v]) => ({
      channel,
      gmvCents: v.gmv,
      feeCents: v.fees,
      netRevenueCents: v.net,
      marginPercent: v.gmv > 0 ? Math.round((v.net / v.gmv) * 100) : 0,
      orderCount: v.count,
    }))
    .sort((a, b) => b.gmvCents - a.gmvCents);
}

export async function getProductProfitabilityByChannel(
  clientId: string,
  channel: string,
  days = 30,
): Promise<ProductProfitabilityRow[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data: orders } = await supabaseAdmin
    .from("orders")
    .select("id, value_cents")
    .eq("client_id", clientId)
    .eq("channel", channel)
    .neq("status", "cancelado")
    .gte("created_at", since.toISOString());

  const orderIds = (orders ?? []).map((o) => o.id as string);
  if (!orderIds.length) return [];

  const { data: items } = await supabaseAdmin
    .from("order_items")
    .select("order_id, sku, name, quantity, unit_price_cents")
    .in("order_id", orderIds);

  const bySku = new Map<
    string,
    { name: string; gmv: number; units: number }
  >();

  for (const item of items ?? []) {
    const sku = item.sku as string;
    const lineGmv = Number(item.unit_price_cents ?? 0) * Number(item.quantity ?? 1);
    const cur = bySku.get(sku) ?? { name: String(item.name ?? sku), gmv: 0, units: 0 };
    cur.gmv += lineGmv;
    cur.units += Number(item.quantity ?? 1);
    bySku.set(sku, cur);
  }

  return [...bySku.entries()]
    .map(([sku, v]) => {
      const feeCents = estimateFees(v.gmv, channel);
      return {
        sku,
        name: v.name,
        channel,
        gmvCents: v.gmv,
        feeCents,
        netRevenueCents: v.gmv - feeCents,
        unitsSold: v.units,
      };
    })
    .sort((a, b) => b.gmvCents - a.gmvCents);
}
