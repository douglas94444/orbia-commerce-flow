import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface SimulationResult {
  impactedCustomers: number;
  expectedConversionRate: number;
  expectedRevenueCents: number;
  benchmarkSource: string;
}

export async function simulateSequence(
  clientId: string,
  trigger: string,
): Promise<SimulationResult> {
  let impactedCustomers = 0;

  if (trigger.startsWith("reativacao")) {
    const days = trigger === "reativacao_30d" ? 30 : trigger === "reativacao_60d" ? 60 : 90;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const { count } = await supabaseAdmin
      .from("customers")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId)
      .lte("last_order_at", cutoff.toISOString());
    impactedCustomers = count ?? 0;
  } else if (trigger === "carrinho_abandonado") {
    const { count } = await supabaseAdmin
      .from("abandoned_carts")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId)
      .eq("status", "open");
    impactedCustomers = count ?? 0;
  } else {
    const { count } = await supabaseAdmin
      .from("customers")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId);
    impactedCustomers = count ?? 0;
  }

  const { data: benchmark } = await supabaseAdmin
    .from("benchmark_snapshots")
    .select("metrics")
    .eq("client_id", clientId)
    .order("captured_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const metrics = (benchmark?.metrics ?? {}) as Record<string, number>;
  const conversionRate = metrics.automation_conversion_rate ?? 0.03;
  const avgOrderCents = metrics.avg_order_cents ?? 15000;

  return {
    impactedCustomers,
    expectedConversionRate: conversionRate,
    expectedRevenueCents: Math.round(impactedCustomers * conversionRate * avgOrderCents),
    benchmarkSource: benchmark ? "orbia_benchmark" : "default_3pct",
  };
}
