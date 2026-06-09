import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { recalculateAllClients } from "@/modules/analytics/health-score.server";
import { syncAllCatalogs } from "@/modules/catalog/sync-catalog.server";
import {
  syncAllGoogleCampaigns,
  syncAllMetaCampaigns,
} from "@/modules/traffic/sync-campaigns.server";
import { logJob, startTimer } from "@/shared/lib/logger";

export type CronJobName =
  | "health-recalc"
  | "sync-campaigns"
  | "sync-catalog"
  | "cleanup-oauth"
  | "all";

export interface JobResult {
  job: string;
  status: "completed" | "failed";
  durationMs: number;
  metadata?: Record<string, unknown>;
  error?: string;
}

async function runJob(name: Exclude<CronJobName, "all">): Promise<JobResult> {
  const end = startTimer();
  const jobId = `${name}-${Date.now()}`;

  await logJob({ job_type: name, job_id: jobId, status: "started" });

  try {
    let metadata: Record<string, unknown> = {};

    switch (name) {
      case "health-recalc":
        metadata = await recalculateAllClients();
        break;
      case "sync-campaigns": {
        const meta = await syncAllMetaCampaigns();
        const google = await syncAllGoogleCampaigns();
        metadata = { meta, google };
        break;
      }
      case "sync-catalog":
        metadata = await syncAllCatalogs();
        break;
      case "cleanup-oauth": {
        const { data: deleted, error } = await supabaseAdmin.rpc("cleanup_expired_oauth_states");
        if (error) throw error;
        metadata = { deleted: deleted ?? 0 };
        break;
      }
    }

    const durationMs = end();
    await logJob({
      job_type: name,
      job_id: jobId,
      status: "completed",
      duration_ms: durationMs,
      metadata,
    });

    return { job: name, status: "completed", durationMs, metadata };
  } catch (err) {
    const durationMs = end();
    const error = (err as Error).message;
    await logJob({
      job_type: name,
      job_id: jobId,
      status: "failed",
      duration_ms: durationMs,
      error,
    });
    return { job: name, status: "failed", durationMs, error };
  }
}

const JOB_SEQUENCE: Array<Exclude<CronJobName, "all">> = [
  "health-recalc",
  "sync-campaigns",
  "sync-catalog",
  "cleanup-oauth",
];

export async function runCronJob(job: CronJobName): Promise<JobResult[]> {
  const jobs = job === "all" ? JOB_SEQUENCE : [job];
  const results: JobResult[] = [];

  for (const name of jobs) {
    results.push(await runJob(name));
  }

  return results;
}
