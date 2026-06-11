import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { pushStockWithVariations } from "./catalog-push.server";

export async function enqueueStockSync(
  clientId: string,
  sku: string,
  idempotencyKey?: string,
): Promise<void> {
  const key = idempotencyKey ?? `${clientId}:${sku}:${Date.now()}`;
  const { error } = await supabaseAdmin.from("stock_sync_jobs").upsert(
    {
      client_id: clientId,
      sku,
      idempotency_key: key,
      status: "queued",
      attempts: 0,
    },
    { onConflict: "idempotency_key", ignoreDuplicates: true },
  );
  if (error) throw new Error(error.message);
}

export async function processStockSyncOutbox(limit = 50): Promise<{ processed: number; failed: number }> {
  const { data: jobs } = await supabaseAdmin
    .from("stock_sync_jobs")
    .select("id, client_id, sku, attempts")
    .eq("status", "queued")
    .order("created_at")
    .limit(limit);

  let processed = 0;
  let failed = 0;

  for (const job of jobs ?? []) {
    try {
      await pushStockWithVariations(job.client_id as string, job.sku as string);
      await supabaseAdmin
        .from("stock_sync_jobs")
        .update({ status: "completed", processed_at: new Date().toISOString() })
        .eq("id", job.id);
      processed += 1;
    } catch (err) {
      const attempts = ((job.attempts as number) ?? 0) + 1;
      await supabaseAdmin
        .from("stock_sync_jobs")
        .update({
          status: attempts >= 3 ? "failed" : "queued",
          attempts,
          last_error: (err as Error).message,
        })
        .eq("id", job.id);
      failed += 1;
    }
  }

  return { processed, failed };
}

export async function listRecentStockSyncs(clientId: string, limit = 20) {
  const { data, error } = await supabaseAdmin
    .from("stock_sync_jobs")
    .select("id, sku, status, attempts, last_error, created_at, processed_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return data ?? [];
}
