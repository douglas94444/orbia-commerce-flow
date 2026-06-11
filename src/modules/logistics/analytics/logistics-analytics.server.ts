import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface LogisticsAnalyticsSummary {
  avgShippingCostCents: number;
  deliveredCount: number;
  onTimeDeliveryPercent: number;
  pickingAccuracyPercent: number;
  picksLast24h: number;
  packsLast24h: number;
  picksPerHour: number;
  packsPerHour: number;
  incidentRatePercent: number;
}

export async function getLogisticsAnalytics(clientId: string): Promise<LogisticsAnalyticsSummary> {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const monthStart = new Date().toISOString().slice(0, 7) + "-01";

  const { data: waves } = await supabaseAdmin
    .from("pick_waves")
    .select("id")
    .eq("client_id", clientId)
    .gte("created_at", since30d);

  const waveIds = (waves ?? []).map((w: { id: string }) => w.id);

  const [
    { data: shippedOrders },
    { data: pickTasks },
    { data: packingSessions },
    { data: usage },
    { data: incidents },
    { data: slaOrders },
  ] = await Promise.all([
    supabaseAdmin
      .from("orders")
      .select("metadata, status")
      .eq("client_id", clientId)
      .in("status", ["despachado", "em_transito", "entregue"])
      .gte("updated_at", since30d)
      .limit(500),
    waveIds.length
      ? supabaseAdmin.from("pick_tasks").select("id").in("wave_id", waveIds)
      : Promise.resolve({ data: [] }),
    supabaseAdmin
      .from("packing_sessions")
      .select("id, completed_at, order_id, orders!inner(client_id)")
      .eq("orders.client_id", clientId)
      .eq("status", "completed")
      .gte("completed_at", since24h),
    supabaseAdmin
      .from("fulfillment_usage")
      .select("picks_completed, packs_completed")
      .eq("client_id", clientId)
      .eq("period_month", monthStart)
      .maybeSingle(),
    supabaseAdmin
      .from("delivery_incidents")
      .select("id, order_id, orders!inner(client_id)")
      .eq("orders.client_id", clientId)
      .gte("created_at", since30d)
      .limit(500),
    supabaseAdmin
      .from("orders")
      .select("id, status, sla_deadline, updated_at")
      .eq("client_id", clientId)
      .eq("status", "entregue")
      .gte("updated_at", since30d)
      .not("sla_deadline", "is", null)
      .limit(500),
  ]);

  const taskIds = (pickTasks ?? []).map((t: { id: string }) => t.id);
  let linesTotal = 0;
  let linesPicked = 0;

  if (taskIds.length) {
    const { data: pickLines } = await supabaseAdmin
      .from("pick_task_lines")
      .select("qty_required, qty_picked")
      .in("task_id", taskIds)
      .limit(2000);

    for (const line of pickLines ?? []) {
      linesTotal += line.qty_required as number;
      linesPicked += line.qty_picked as number;
    }
  }

  const shippingCosts: number[] = [];
  for (const o of shippedOrders ?? []) {
    const meta = (o.metadata ?? {}) as Record<string, unknown>;
    const cost = meta.shipping_cost_cents;
    if (typeof cost === "number" && cost > 0) shippingCosts.push(cost);
  }
  const avgShippingCostCents =
    shippingCosts.length > 0
      ? Math.round(shippingCosts.reduce((s, c) => s + c, 0) / shippingCosts.length)
      : 0;

  const pickingAccuracyPercent =
    linesTotal > 0 ? Math.round((linesPicked / linesTotal) * 100) : 100;

  const packsLast24h = (packingSessions ?? []).length;
  const picksLast24h = (usage?.picks_completed as number) ?? linesPicked;
  const packsFromUsage = (usage?.packs_completed as number) ?? packsLast24h;

  let onTime = 0;
  for (const o of slaOrders ?? []) {
    const deadline = new Date(o.sla_deadline as string).getTime();
    const deliveredAt = new Date(o.updated_at as string).getTime();
    if (deliveredAt <= deadline) onTime += 1;
  }
  const slaTotal = (slaOrders ?? []).length;
  const onTimeDeliveryPercent = slaTotal > 0 ? Math.round((onTime / slaTotal) * 100) : 0;

  const deliveredCount = (shippedOrders ?? []).filter((o) => o.status === "entregue").length;
  const incidentCount = (incidents ?? []).length;
  const orderVolume = (shippedOrders ?? []).length || 1;
  const incidentRatePercent = Math.round((incidentCount / orderVolume) * 100);

  const effectivePacks = packsFromUsage || packsLast24h;

  return {
    avgShippingCostCents,
    deliveredCount,
    onTimeDeliveryPercent,
    pickingAccuracyPercent,
    picksLast24h,
    packsLast24h: effectivePacks,
    picksPerHour: Math.round((picksLast24h / 24) * 10) / 10,
    packsPerHour: Math.round((effectivePacks / 24) * 10) / 10,
    incidentRatePercent,
  };
}
