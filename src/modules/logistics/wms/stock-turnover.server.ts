import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface StockTurnoverRow {
  sku: string;
  unitsSold30d: number;
  avgInventory: number;
  turnover: number;
}

export async function listStockTurnover(
  clientId: string,
  limit = 50,
): Promise<StockTurnoverRow[]> {
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const [{ data: movements }, { data: inventory }] = await Promise.all([
    supabaseAdmin
      .from("stock_movements")
      .select("sku, qty")
      .eq("client_id", clientId)
      .in("movement_type", ["saida", "commit"])
      .gte("created_at", since.toISOString()),
    supabaseAdmin.from("inventory").select("sku, units").eq("client_id", clientId),
  ]);

  const soldMap = new Map<string, number>();
  for (const m of movements ?? []) {
    const sku = m.sku as string;
    soldMap.set(sku, (soldMap.get(sku) ?? 0) + (m.qty as number));
  }

  const rows: StockTurnoverRow[] = [];
  for (const inv of inventory ?? []) {
    const sku = inv.sku as string;
    const unitsSold30d = soldMap.get(sku) ?? 0;
    const avgInventory = Math.max(1, inv.units as number);
    const turnover = Math.round((unitsSold30d / avgInventory) * 100) / 100;
    rows.push({ sku, unitsSold30d, avgInventory: inv.units as number, turnover });
  }

  return rows.sort((a, b) => b.turnover - a.turnover).slice(0, limit);
}
