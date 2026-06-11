import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { dispatchOrder } from "./dispatch.server";

export interface BatchLabelResult {
  orderId: string;
  trackingCode?: string;
  error?: string;
}

export async function generateLabelsForWave(waveId: string): Promise<BatchLabelResult[]> {
  const { data: tasks } = await supabaseAdmin
    .from("pick_tasks")
    .select("order_id")
    .eq("wave_id", waveId)
    .eq("status", "completed");

  const results: BatchLabelResult[] = [];
  for (const task of tasks ?? []) {
    const orderId = task.order_id as string;
    try {
      const { trackingCode } = await dispatchOrder(orderId);
      results.push({ orderId, trackingCode });
    } catch (err) {
      results.push({ orderId, error: (err as Error).message });
    }
  }
  return results;
}

export async function buildDispatchManifest(waveId: string): Promise<{
  waveId: string;
  generatedAt: string;
  orders: Array<{ orderId: string; trackingCode: string | null; carrier: string | null }>;
}> {
  const { data: tasks } = await supabaseAdmin
    .from("pick_tasks")
    .select("order_id, orders(tracking_code, carrier)")
    .eq("wave_id", waveId);

  return {
    waveId,
    generatedAt: new Date().toISOString(),
    orders: (tasks ?? []).map((t) => {
      const o = t.orders as { tracking_code: string | null; carrier: string | null } | null;
      return {
        orderId: t.order_id as string,
        trackingCode: o?.tracking_code ?? null,
        carrier: o?.carrier ?? null,
      };
    }),
  };
}
