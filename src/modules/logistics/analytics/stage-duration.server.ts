import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface StageDurationRow {
  stage: string;
  label: string;
  medianHours: number;
  p95Hours: number;
  sampleSize: number;
}

const STAGE_PAIRS: Array<{ from: string; to: string; label: string }> = [
  { from: "separacao", to: "em_picking", label: "Separação → Picking" },
  { from: "em_picking", to: "em_packing", label: "Picking → Packing" },
  { from: "em_packing", to: "despachado", label: "Packing → Despacho" },
  { from: "despachado", to: "entregue", label: "Despacho → Entrega" },
];

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function p95(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1);
  return sorted[idx] ?? 0;
}

export async function getStageDurations(clientId: string, days = 30): Promise<StageDurationRow[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data: orders } = await supabaseAdmin
    .from("orders")
    .select("id")
    .eq("client_id", clientId)
    .gte("created_at", since.toISOString())
    .limit(500);

  const orderIds = (orders ?? []).map((o) => o.id as string);
  if (!orderIds.length) {
    return STAGE_PAIRS.map((p) => ({
      stage: `${p.from}->${p.to}`,
      label: p.label,
      medianHours: 0,
      p95Hours: 0,
      sampleSize: 0,
    }));
  }

  const { data: events } = await supabaseAdmin
    .from("order_events")
    .select("order_id, status, occurred_at")
    .in("order_id", orderIds)
    .order("occurred_at");

  const byOrder = new Map<string, Array<{ status: string; at: number }>>();
  for (const ev of events ?? []) {
    const list = byOrder.get(ev.order_id as string) ?? [];
    list.push({ status: ev.status as string, at: new Date(ev.occurred_at as string).getTime() });
    byOrder.set(ev.order_id as string, list);
  }

  const durations = new Map<string, number[]>();
  for (const pair of STAGE_PAIRS) {
    durations.set(`${pair.from}->${pair.to}`, []);
  }

  for (const list of byOrder.values()) {
    const statusFirst = new Map<string, number>();
    for (const ev of list) {
      if (!statusFirst.has(ev.status)) statusFirst.set(ev.status, ev.at);
    }
    for (const pair of STAGE_PAIRS) {
      const fromAt = statusFirst.get(pair.from);
      const toAt = statusFirst.get(pair.to);
      if (fromAt != null && toAt != null && toAt > fromAt) {
        const hours = (toAt - fromAt) / (60 * 60 * 1000);
        durations.get(`${pair.from}->${pair.to}`)!.push(hours);
      }
    }
  }

  return STAGE_PAIRS.map((pair) => {
    const key = `${pair.from}->${pair.to}`;
    const values = durations.get(key) ?? [];
    return {
      stage: key,
      label: pair.label,
      medianHours: Math.round(median(values) * 10) / 10,
      p95Hours: Math.round(p95(values) * 10) / 10,
      sampleSize: values.length,
    };
  });
}
