import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface StockRuptureForecast {
  sku: string;
  currentAvailable: number;
  dailyVelocity: number;
  daysUntilRupture: number | null;
  risk: "ok" | "atencao" | "critico";
}

export async function predictStockRupture(clientId: string): Promise<StockRuptureForecast[]> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [{ data: movements }, { data: inventory }] = await Promise.all([
    supabaseAdmin
      .from("stock_movements")
      .select("sku, qty, movement_type")
      .eq("client_id", clientId)
      .in("movement_type", ["commit", "saida"])
      .gte("created_at", since),
    supabaseAdmin
      .from("inventory")
      .select("sku, units, reserved")
      .eq("client_id", clientId),
  ]);

  const velocityMap = new Map<string, number>();
  for (const m of movements ?? []) {
    const sku = m.sku as string;
    velocityMap.set(sku, (velocityMap.get(sku) ?? 0) + (m.qty as number));
  }

  const forecasts: StockRuptureForecast[] = [];
  for (const inv of inventory ?? []) {
    const sku = inv.sku as string;
    const available = (inv.units as number) - ((inv.reserved as number) ?? 0);
    const totalOut = velocityMap.get(sku) ?? 0;
    const dailyVelocity = totalOut / 30;
    const daysUntilRupture =
      dailyVelocity > 0 ? Math.floor(available / dailyVelocity) : null;

    let risk: StockRuptureForecast["risk"] = "ok";
    if (daysUntilRupture !== null && daysUntilRupture <= 7) risk = "critico";
    else if (daysUntilRupture !== null && daysUntilRupture <= 14) risk = "atencao";

    if (dailyVelocity > 0) {
      forecasts.push({ sku, currentAvailable: available, dailyVelocity, daysUntilRupture, risk });
    }
  }

  return forecasts.sort((a, b) => {
    const da = a.daysUntilRupture ?? 999;
    const db = b.daysUntilRupture ?? 999;
    return da - db;
  });
}
