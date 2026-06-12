import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface RealMarginSummary {
  gmvCents: number;
  adSpendCents: number;
  cogsCents: number;
  fulfillmentCostCents: number;
  marginPercent: number;
  marginCents: number;
}

export async function computeRealMargin(clientId: string, days = 30): Promise<RealMarginSummary> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const [{ data: orders }, { data: campaigns }, { data: products }] = await Promise.all([
    supabaseAdmin
      .from("orders")
      .select("value_cents, metadata")
      .eq("client_id", clientId)
      .gte("created_at", since.toISOString())
      .not("status", "eq", "cancelado"),
    supabaseAdmin
      .from("campaigns")
      .select("spend_cents")
      .eq("client_id", clientId)
      .gte("updated_at", since.toISOString()),
    supabaseAdmin.from("products").select("sku, price_cents, metadata").eq("client_id", clientId),
  ]);

  const costBySku = new Map<string, number>();
  for (const p of products ?? []) {
    const meta = (p.metadata ?? {}) as Record<string, unknown>;
    const cost = Number(meta.cost_cents ?? (p.price_cents as number) * 0.55);
    costBySku.set(p.sku as string, cost);
  }

  let gmvCents = 0;
  let fulfillmentCostCents = 0;
  let cogsCents = 0;

  for (const o of orders ?? []) {
    gmvCents += (o.value_cents as number) ?? 0;
    const meta = (o.metadata ?? {}) as Record<string, unknown>;
    fulfillmentCostCents += Number(meta.shipping_cost_cents ?? 0);
    fulfillmentCostCents += Number(meta.fulfillment_fee_cents ?? 0);

    const items = (meta.items as Array<{ sku: string; qty: number }>) ?? [];
    for (const item of items) {
      const unitCost = costBySku.get(item.sku) ?? 0;
      cogsCents += unitCost * item.qty;
    }
  }

  const adSpendCents = (campaigns ?? []).reduce(
    (s, c) => s + Number(c.spend_cents ?? 0),
    0,
  );

  const marginCents = gmvCents - adSpendCents - cogsCents - fulfillmentCostCents;
  const marginPercent =
    gmvCents > 0 ? Math.round((marginCents / gmvCents) * 1000) / 10 : 0;

  return {
    gmvCents,
    adSpendCents,
    cogsCents,
    fulfillmentCostCents,
    marginCents,
    marginPercent,
  };
}
