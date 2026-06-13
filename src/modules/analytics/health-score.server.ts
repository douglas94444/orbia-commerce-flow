import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getSlaDashboard } from "@/modules/logistics/sla/sla-engine.server";
import { refreshOperationAlerts } from "./alert-engine.server";

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export async function computeHealthScore(clientId: string): Promise<number> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [clientRes, ordersRes, customersRes, flowsRes, slaDash, sacRes, csatRes] = await Promise.all([
    supabaseAdmin.from("clients").select("roas_avg, last_contact_days").eq("id", clientId).single(),
    supabaseAdmin
      .from("orders")
      .select("status, value_cents, created_at")
      .eq("client_id", clientId)
      .gte("created_at", thirtyDaysAgo.toISOString()),
    supabaseAdmin.from("customers").select("ltv_cents").eq("client_id", clientId),
    supabaseAdmin.from("automation_flows").select("sent_30d").eq("client_id", clientId),
    getSlaDashboard(clientId),
    supabaseAdmin
      .from("sac_tickets")
      .select("id, status")
      .eq("client_id", clientId)
      .gte("created_at", thirtyDaysAgo.toISOString()),
    supabaseAdmin
      .from("sac_csat_surveys")
      .select("score")
      .eq("client_id", clientId)
      .not("score", "is", null)
      .gte("created_at", thirtyDaysAgo.toISOString()),
  ]);

  const client = clientRes.data;
  const orders = ordersRes.data ?? [];
  const customers = customersRes.data ?? [];
  const flows = flowsRes.data ?? [];

  const roas = Number(client?.roas_avg ?? 0);
  const roasScore = roas >= 6 ? 100 : roas >= 4 ? 70 : roas > 0 ? 40 : 50;

  const slaScore = clampScore(slaDash.compliancePercent);

  const gmvCents = orders
    .filter((o) => o.status !== "cancelado")
    .reduce((s, o) => s + (o.value_cents ?? 0), 0);
  const ltvTotal = customers.reduce((s, c) => s + (c.ltv_cents ?? 0), 0);
  const ltvRatio = gmvCents > 0 ? ltvTotal / gmvCents : 0.5;
  const ltvScore = clampScore(ltvRatio * 100);

  const sent30d = flows.reduce((s, f) => s + (f.sent_30d ?? 0), 0);
  const engagementScore = clampScore(Math.min(100, sent30d * 5));

  const contactDays = client?.last_contact_days ?? 0;
  const csScore = contactDays === 0 ? 75 : contactDays <= 7 ? 100 : contactDays <= 14 ? 70 : 40;

  const sacTickets = sacRes.data ?? [];
  const openSac = sacTickets.filter((t) => !["closed", "merged", "resolved"].includes(t.status)).length;
  const sacVolume = sacTickets.length;
  const sacPenalty = sacVolume > 0 ? Math.min(40, openSac * 5 + sacVolume) : 0;
  const csatScores = (csatRes.data ?? []).map((c) => c.score as number);
  const csatAvg = csatScores.length > 0 ? csatScores.reduce((s, v) => s + v, 0) / csatScores.length : 4;
  const sacScore = clampScore(100 - sacPenalty + (csatAvg - 3) * 10);

  const weighted =
    roasScore * 0.27 +
    slaScore * 0.23 +
    ltvScore * 0.18 +
    engagementScore * 0.12 +
    csScore * 0.1 +
    sacScore * 0.1;

  return clampScore(weighted);
}

async function computeGmv30d(clientId: string): Promise<number> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data } = await supabaseAdmin
    .from("orders")
    .select("value_cents, status")
    .eq("client_id", clientId)
    .gte("created_at", thirtyDaysAgo.toISOString());

  return (data ?? [])
    .filter((o) => o.status !== "cancelado")
    .reduce((s, o) => s + o.value_cents, 0);
}

async function computeRoasAvg(clientId: string): Promise<number> {
  const { data } = await supabaseAdmin
    .from("campaigns")
    .select("roas, spend_cents")
    .eq("client_id", clientId);

  const rows = data ?? [];
  const totalSpend = rows.reduce((s, r) => s + r.spend_cents, 0);
  if (totalSpend <= 0) return 0;

  const weighted = rows.reduce((s, r) => s + Number(r.roas) * r.spend_cents, 0);
  return Number((weighted / totalSpend).toFixed(2));
}

export async function recalculateClientMetrics(clientId: string): Promise<void> {
  const [gmv30d, roasAvg, healthScore] = await Promise.all([
    computeGmv30d(clientId),
    computeRoasAvg(clientId),
    computeHealthScore(clientId),
  ]);

  await supabaseAdmin
    .from("clients")
    .update({
      gmv_30d: gmv30d,
      roas_avg: roasAvg,
      health_score: healthScore,
      updated_at: new Date().toISOString(),
    })
    .eq("id", clientId);

  await refreshOperationAlerts(clientId);
}

export async function recalculateAllClients(): Promise<{ updated: number }> {
  const { data: clients } = await supabaseAdmin
    .from("clients")
    .select("id")
    .eq("status", "active");

  let updated = 0;
  for (const client of clients ?? []) {
    await recalculateClientMetrics(client.id);
    updated += 1;
  }
  return { updated };
}
