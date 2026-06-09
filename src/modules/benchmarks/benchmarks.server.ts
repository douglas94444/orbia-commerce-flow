import { supabaseAdmin } from "@/integrations/supabase/client.server";

/** Snapshot de benchmarks da carteira — ROAS, margem proxy, SLA, NPS. */
export async function captureBenchmarkSnapshots(): Promise<number> {
  const { data: clients } = await supabaseAdmin
    .from("clients")
    .select("id, health_score")
    .eq("status", "active");

  const { data: campaigns } = await supabaseAdmin.from("campaigns").select("client_id, roas, spend_cents, revenue_cents");
  const { data: orders } = await supabaseAdmin.from("orders").select("client_id, status").gte("created_at", new Date(Date.now() - 30 * 86400000).toISOString());

  const roasByClient = new Map<string, number[]>();
  for (const c of campaigns ?? []) {
    const list = roasByClient.get(c.client_id) ?? [];
    list.push(Number(c.roas ?? 0));
    roasByClient.set(c.client_id, list);
  }

  const slaByClient = new Map<string, { total: number; delivered: number }>();
  for (const o of orders ?? []) {
    const cur = slaByClient.get(o.client_id) ?? { total: 0, delivered: 0 };
    cur.total++;
    if (o.status === "entregue") cur.delivered++;
    slaByClient.set(o.client_id, cur);
  }

  const allRoas: number[] = [];
  let created = 0;

  for (const client of clients ?? []) {
    const roasList = roasByClient.get(client.id) ?? [];
    const avgRoas = roasList.length ? roasList.reduce((a, b) => a + b, 0) / roasList.length : 0;
    allRoas.push(avgRoas);

    const sla = slaByClient.get(client.id);
    const slaPct = sla && sla.total > 0 ? (sla.delivered / sla.total) * 100 : 0;

    await supabaseAdmin.from("benchmark_snapshots").insert([
      { client_id: client.id, metric_key: "roas", value: avgRoas, portfolio_avg: null },
      { client_id: client.id, metric_key: "sla", value: slaPct, portfolio_avg: null },
      { client_id: client.id, metric_key: "health", value: client.health_score ?? 0, portfolio_avg: null },
    ]);
    created += 3;
  }

  const portfolioAvgRoas = allRoas.length ? allRoas.reduce((a, b) => a + b, 0) / allRoas.length : 0;
  const sorted = [...allRoas].sort((a, b) => a - b);
  const p75 = sorted[Math.floor(sorted.length * 0.75)] ?? 0;

  await supabaseAdmin.from("benchmark_snapshots").insert({
    client_id: null,
    metric_key: "roas",
    value: portfolioAvgRoas,
    portfolio_avg: portfolioAvgRoas,
    portfolio_p75: p75,
    ai_summary: `Carteira com ROAS médio ${portfolioAvgRoas.toFixed(1)}x. P75: ${p75.toFixed(1)}x.`,
  });
  created++;

  return created;
}
