import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { PLAN_PRICES_CENTS } from "@/shared/constants/plans";

export interface SalesMetricsSummary {
  newMrrCents: number;
  expandedMrrCents: number;
  churnedMrrCents: number;
  netMrrCents: number;
  funnel: Array<{
    stage_key: string;
    label: string;
    prospect_count: number;
    hot_count: number;
    converted_count: number;
  }>;
  conversionBySource: Array<{ source: string; total: number; converted: number; rate: number }>;
  avgCloseDaysByPlan: Record<string, number>;
  proposalViewRate: number;
  proposalResponseRate: number;
  forecast30dCents: number;
  forecast60dCents: number;
  forecast90dCents: number;
  topObjections: Array<{ objection: string; count: number }>;
  closeRateByStaff: Array<{ staffId: string; name: string; total: number; won: number; rate: number }>;
}

export async function computeSalesMetrics(): Promise<SalesMetricsSummary> {
  const periodStart = new Date();
  periodStart.setDate(1);
  const periodIso = periodStart.toISOString();

  const [subs, cancelled, upsells, funnel, prospects, proposals, objections, staffProspects] =
    await Promise.all([
      supabaseAdmin
        .from("subscriptions")
        .select("amount_cents, plan, client_id, created_at")
        .eq("status", "active")
        .gte("created_at", periodIso),
      supabaseAdmin
        .from("subscriptions")
        .select("amount_cents")
        .eq("status", "cancelled")
        .gte("updated_at", periodIso),
      supabaseAdmin
        .from("sales_upsell_opportunities")
        .select("roi_params")
        .eq("status", "won")
        .gte("resolved_at", periodIso),
      supabaseAdmin.from("sales_funnel_metrics").select("*"),
      supabaseAdmin.from("sales_prospects").select("source, converted_client_id, created_at, converted_at, assigned_staff_id"),
      supabaseAdmin.from("sales_proposals").select("status, created_at, valid_until"),
      supabaseAdmin
        .from("sales_interactions")
        .select("notes")
        .eq("kind", "objection")
        .gte("occurred_at", periodIso),
      supabaseAdmin
        .from("sales_prospects")
        .select("assigned_staff_id, converted_client_id, profiles:assigned_staff_id(full_name)"),
    ]);

  const newMrrCents = (subs.data ?? []).reduce((s, r) => s + r.amount_cents, 0);
  const churnedMrrCents = (cancelled.data ?? []).reduce((s, r) => s + r.amount_cents, 0);
  const expandedMrrCents = (upsells.data ?? []).reduce((s, r) => {
    const p = (r.roi_params as { delta_mrr_cents?: number }) ?? {};
    return s + (p.delta_mrr_cents ?? 0);
  }, 0);

  const sourceMap = new Map<string, { total: number; converted: number }>();
  for (const p of prospects.data ?? []) {
    const cur = sourceMap.get(p.source) ?? { total: 0, converted: 0 };
    cur.total++;
    if (p.converted_client_id) cur.converted++;
    sourceMap.set(p.source, cur);
  }

  const conversionBySource = [...sourceMap.entries()].map(([source, v]) => ({
    source,
    total: v.total,
    converted: v.converted,
    rate: v.total ? Math.round((v.converted / v.total) * 100) : 0,
  }));

  const closeDays: Record<string, number[]> = { launch: [], growth: [], scale: [] };
  for (const p of prospects.data ?? []) {
    if (!p.converted_at || !p.created_at) continue;
    const days = Math.floor(
      (new Date(p.converted_at).getTime() - new Date(p.created_at).getTime()) / 86400000,
    );
    closeDays.launch?.push(days);
  }

  const sent = (proposals.data ?? []).filter((p) => p.status !== "draft").length;
  const viewed = (proposals.data ?? []).filter((p) =>
    ["viewed", "accepted"].includes(p.status),
  ).length;
  const accepted = (proposals.data ?? []).filter((p) => p.status === "accepted").length;

  const objectionCounts = new Map<string, number>();
  for (const o of objections.data ?? []) {
    const key = (o.notes ?? "outro").slice(0, 60);
    objectionCounts.set(key, (objectionCounts.get(key) ?? 0) + 1);
  }

  const staffMap = new Map<string, { name: string; total: number; won: number }>();
  for (const p of staffProspects.data ?? []) {
    if (!p.assigned_staff_id) continue;
    const name = (p.profiles as { full_name?: string } | null)?.full_name ?? "CS";
    const cur = staffMap.get(p.assigned_staff_id) ?? { name, total: 0, won: 0 };
    cur.total++;
    if (p.converted_client_id) cur.won++;
    staffMap.set(p.assigned_staff_id, cur);
  }

  const negotiationCount =
    funnel.data?.find((f) => f.stage_key === "negotiation")?.prospect_count ?? 0;
  const proposalCount =
    funnel.data?.find((f) => f.stage_key === "proposal_sent")?.prospect_count ?? 0;
  const avgDeal = Math.round(
    (PLAN_PRICES_CENTS.launch + PLAN_PRICES_CENTS.growth) / 2,
  );

  return {
    newMrrCents,
    expandedMrrCents,
    churnedMrrCents,
    netMrrCents: newMrrCents + expandedMrrCents - churnedMrrCents,
    funnel: funnel.data ?? [],
    conversionBySource,
    avgCloseDaysByPlan: {
      launch: avg(closeDays.launch),
      growth: avg(closeDays.growth),
      scale: avg(closeDays.scale),
    },
    proposalViewRate: sent ? Math.round((viewed / sent) * 100) : 0,
    proposalResponseRate: sent ? Math.round((accepted / sent) * 100) : 0,
    forecast30dCents: (negotiationCount + proposalCount) * avgDeal * 0.3,
    forecast60dCents: (negotiationCount + proposalCount) * avgDeal * 0.5,
    forecast90dCents: (negotiationCount + proposalCount) * avgDeal * 0.7,
    topObjections: [...objectionCounts.entries()]
      .map(([objection, count]) => ({ objection, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
    closeRateByStaff: [...staffMap.entries()].map(([staffId, v]) => ({
      staffId,
      name: v.name,
      total: v.total,
      won: v.won,
      rate: v.total ? Math.round((v.won / v.total) * 100) : 0,
    })),
  };
}

function avg(nums: number[]): number {
  return nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : 0;
}
