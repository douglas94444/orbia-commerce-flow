import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { PLAN_ORDER_LIMITS, type PlanTier } from "@/shared/constants/plans";
import type { Json } from "@/integrations/supabase/types";

export async function scanUpsellOpportunities(): Promise<number> {
  const { data: clients } = await supabaseAdmin
    .from("clients")
    .select("id, plan, health_score, gmv_30d, status")
    .eq("status", "active");

  let created = 0;

  for (const c of clients ?? []) {
    const plan = c.plan as PlanTier;

    if (plan === "launch") {
      const growing = await hasGmvGrowthMonths(c.id, 3);
      if (growing) {
        await upsertOpportunity(c.id, "gmv_growth", plan, "growth", {
          reason: "GMV crescente por 3 meses consecutivos",
        });
        created++;
      }
    }

    if (plan === "growth") {
      const usage = await getFulfillmentUsagePercent(c.id);
      if (usage >= 90) {
        await upsertOpportunity(c.id, "fulfillment_limit", plan, "scale", {
          usagePercent: usage,
          limit: PLAN_ORDER_LIMITS.growth,
        });
        created++;
      }
    }

    if ((c.health_score ?? 100) < 50) {
      await upsertOpportunity(c.id, "health_low", plan, null, {
        healthScore: c.health_score,
      });
      created++;
    }
  }

  return created;
}

async function hasGmvGrowthMonths(clientId: string, months: number): Promise<boolean> {
  const { data: orders } = await supabaseAdmin
    .from("orders")
    .select("total_cents, created_at")
    .eq("client_id", clientId)
    .eq("status", "entregue")
    .gte("created_at", new Date(Date.now() - months * 30 * 86400000).toISOString());

  const byMonth = new Map<string, number>();
  for (const o of orders ?? []) {
    const key = o.created_at.slice(0, 7);
    byMonth.set(key, (byMonth.get(key) ?? 0) + Number(o.total_cents));
  }

  const values = [...byMonth.values()].sort();
  if (values.length < months) return false;
  for (let i = 1; i < values.length; i++) {
    if (values[i] <= values[i - 1]) return false;
  }
  return true;
}

async function getFulfillmentUsagePercent(clientId: string): Promise<number> {
  const { data: usage } = await supabaseAdmin
    .from("fulfillment_usage")
    .select("orders_count")
    .eq("client_id", clientId)
    .gte("period_start", new Date(Date.now() - 30 * 86400000).toISOString())
    .maybeSingle();

  const { data: client } = await supabaseAdmin
    .from("clients")
    .select("plan")
    .eq("id", clientId)
    .single();

  const limit = PLAN_ORDER_LIMITS[(client?.plan as PlanTier) ?? "launch"];
  const count = usage?.orders_count ?? 0;
  return Math.round((count / limit) * 100);
}

async function upsertOpportunity(
  clientId: string,
  triggerType: string,
  fromPlan: PlanTier,
  toPlan: PlanTier | null,
  roiParams: Record<string, unknown>,
): Promise<void> {
  const { data: existing } = await supabaseAdmin
    .from("sales_upsell_opportunities")
    .select("id")
    .eq("client_id", clientId)
    .eq("trigger_type", triggerType)
    .eq("status", "open")
    .maybeSingle();

  if (existing) return;

  await supabaseAdmin.from("sales_upsell_opportunities").insert({
    client_id: clientId,
    trigger_type: triggerType,
    from_plan: fromPlan,
    to_plan: toPlan,
    roi_params: roiParams as unknown as Json,
    status: "open",
  });
}

export async function listUpsellOpportunities() {
  const { data } = await supabaseAdmin
    .from("sales_upsell_opportunities")
    .select("*, clients(name, plan, health_score, gmv_30d)")
    .in("status", ["open", "proposed"])
    .order("created_at", { ascending: false })
    .limit(50);
  return data ?? [];
}
