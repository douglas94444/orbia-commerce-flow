import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface CarrierCostRow {
  provider: string;
  orderCount: number;
  avgCostCents: number;
  totalCostCents: number;
}

export interface MonthlyShippingCostRow {
  month: string;
  avgCostCents: number;
  orderCount: number;
}

export async function getShippingCostByCarrier(
  clientId: string,
  days = 30,
): Promise<CarrierCostRow[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data: shipments } = await supabaseAdmin
    .from("shipments")
    .select("provider, order_id, orders!inner(client_id, metadata)")
    .eq("orders.client_id", clientId)
    .gte("created_at", since.toISOString())
    .limit(1000);

  const byProvider = new Map<string, { total: number; count: number }>();

  for (const row of shipments ?? []) {
    const provider = (row.provider as string) || "desconhecido";
    const meta = ((row.orders as { metadata?: Record<string, unknown> })?.metadata ??
      {}) as Record<string, unknown>;
    const cost = (meta.shipping_cost_cents as number) ?? 0;
    const cur = byProvider.get(provider) ?? { total: 0, count: 0 };
    cur.total += cost;
    cur.count += 1;
    byProvider.set(provider, cur);
  }

  if (byProvider.size === 0) {
    const { data: orders } = await supabaseAdmin
      .from("orders")
      .select("carrier, metadata")
      .eq("client_id", clientId)
      .in("status", ["despachado", "em_transito", "entregue"])
      .gte("updated_at", since.toISOString())
      .limit(500);

    for (const o of orders ?? []) {
      const provider = (o.carrier as string) || "desconhecido";
      const meta = (o.metadata ?? {}) as Record<string, unknown>;
      const cost = (meta.shipping_cost_cents as number) ?? 0;
      const cur = byProvider.get(provider) ?? { total: 0, count: 0 };
      cur.total += cost;
      cur.count += 1;
      byProvider.set(provider, cur);
    }
  }

  return [...byProvider.entries()]
    .map(([provider, v]) => ({
      provider,
      orderCount: v.count,
      avgCostCents: v.count > 0 ? Math.round(v.total / v.count) : 0,
      totalCostCents: v.total,
    }))
    .sort((a, b) => b.orderCount - a.orderCount);
}

export async function getMonthlyShippingCosts(
  clientId: string,
  months = 6,
): Promise<MonthlyShippingCostRow[]> {
  const since = new Date();
  since.setMonth(since.getMonth() - months);

  const { data: orders } = await supabaseAdmin
    .from("orders")
    .select("updated_at, metadata")
    .eq("client_id", clientId)
    .in("status", ["despachado", "em_transito", "entregue"])
    .gte("updated_at", since.toISOString())
    .limit(2000);

  const byMonth = new Map<string, { total: number; count: number }>();
  for (const o of orders ?? []) {
    const month = (o.updated_at as string).slice(0, 7);
    const meta = (o.metadata ?? {}) as Record<string, unknown>;
    const cost = (meta.shipping_cost_cents as number) ?? 0;
    const cur = byMonth.get(month) ?? { total: 0, count: 0 };
    cur.total += cost;
    cur.count += 1;
    byMonth.set(month, cur);
  }

  return [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({
      month,
      avgCostCents: v.count > 0 ? Math.round(v.total / v.count) : 0,
      orderCount: v.count,
    }));
}
