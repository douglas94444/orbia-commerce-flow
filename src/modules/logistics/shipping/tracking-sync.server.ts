import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { syncTracking as syncOrderTracking } from "../shipping.server";
import type { Json } from "@/integrations/supabase/types";

const BATCH = 100;
const FAILURE_ALERT_THRESHOLD = 3;

async function incrementSyncFailure(
  orderId: string,
  clientId: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  const failures = Number(metadata.tracking_sync_failures ?? 0) + 1;
  const nextMeta = { ...metadata, tracking_sync_failures: failures };

  await supabaseAdmin
    .from("orders")
    .update({ metadata: nextMeta, updated_at: new Date().toISOString() })
    .eq("id", orderId);

  if (failures >= FAILURE_ALERT_THRESHOLD && !metadata.tracking_sync_alert_sent) {
    await supabaseAdmin.from("operation_alerts").insert({
      client_id: clientId,
      kind: "sla",
      severity: "warning",
      title: "Falha no sync de rastreamento",
      message: `Pedido ${orderId.slice(0, 8)}… com ${failures} falhas consecutivas de sync`,
      is_resolved: false,
    });
    await supabaseAdmin
      .from("orders")
      .update({
        metadata: { ...nextMeta, tracking_sync_alert_sent: true },
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);
  }
}

async function resetSyncFailures(orderId: string, metadata: Record<string, unknown>): Promise<void> {
  if (!metadata.tracking_sync_failures && !metadata.tracking_sync_alert_sent) return;
  const { tracking_sync_failures: _f, tracking_sync_alert_sent: _a, ...rest } = metadata;
  await supabaseAdmin
    .from("orders")
    .update({ metadata: rest as Json, updated_at: new Date().toISOString() })
    .eq("id", orderId);
}

export async function syncAllTracking(): Promise<{
  synced: number;
  problems: number;
  failed: number;
  batches: number;
}> {
  let synced = 0;
  let problems = 0;
  let failed = 0;
  let batches = 0;
  let offset = 0;

  while (true) {
    const { data: orders } = await supabaseAdmin
      .from("orders")
      .select("id, client_id, metadata")
      .in("status", ["despachado", "em_transito"])
      .not("shipment_external_id", "is", null)
      .range(offset, offset + BATCH - 1);

    if (!orders?.length) break;
    batches += 1;

    for (const order of orders) {
      const meta = (order.metadata ?? {}) as Record<string, unknown>;
      try {
        const result = await syncOrderTracking(order.id as string);
        synced += 1;
        if (result.problemRecorded) problems += 1;
        await resetSyncFailures(order.id as string, meta);
      } catch (err) {
        failed += 1;
        console.error(`[sync-tracking] order ${order.id}:`, err);
        await incrementSyncFailure(order.id as string, order.client_id as string, meta);
      }
    }

    if (orders.length < BATCH) break;
    offset += BATCH;
  }

  return { synced, problems, failed, batches };
}
