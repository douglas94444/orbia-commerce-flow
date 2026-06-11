import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { dispatchOrder } from "./dispatch.server";

export interface BatchLabelResult {
  orderId: string;
  trackingCode?: string;
  labelUrl?: string;
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
      const { trackingCode, labelUrl } = await dispatchOrder(orderId);
      results.push({ orderId, trackingCode, labelUrl });
    } catch (err) {
      results.push({ orderId, error: (err as Error).message });
    }
  }
  return results;
}

export async function buildDispatchManifest(waveId: string): Promise<{
  waveId: string;
  generatedAt: string;
  orders: Array<{
    orderId: string;
    trackingCode: string | null;
    carrier: string | null;
    labelUrl: string | null;
  }>;
}> {
  const { data: tasks } = await supabaseAdmin
    .from("pick_tasks")
    .select("order_id, orders(tracking_code, carrier, metadata)")
    .eq("wave_id", waveId);

  return {
    waveId,
    generatedAt: new Date().toISOString(),
    orders: (tasks ?? []).map((t) => {
      const o = t.orders as {
        tracking_code: string | null;
        carrier: string | null;
        metadata: Record<string, unknown> | null;
      } | null;
      return {
        orderId: t.order_id as string,
        trackingCode: o?.tracking_code ?? null,
        carrier: o?.carrier ?? null,
        labelUrl: (o?.metadata?.label_url as string | null) ?? null,
      };
    }),
  };
}

export async function exportManifestCsv(waveId: string): Promise<string> {
  const manifest = await buildDispatchManifest(waveId);
  const header = "order_id,tracking_code,carrier,label_url\n";
  const rows = manifest.orders
    .map((o) =>
      [o.orderId, o.trackingCode ?? "", o.carrier ?? "", o.labelUrl ?? ""].join(","),
    )
    .join("\n");
  return header + rows;
}
