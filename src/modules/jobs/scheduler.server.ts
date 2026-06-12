import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { recalculateAllClients } from "@/modules/analytics/health-score.server";
import { syncAllCatalogs } from "@/modules/catalog/sync-catalog.server";
import {
  syncAllGoogleCampaigns,
  syncAllMetaCampaigns,
} from "@/modules/traffic/sync-campaigns.server";
import { logJob, startTimer } from "@/shared/lib/logger";
import { processOutboxBatch } from "@/shared/lib/domain-events.server";
import { captureBenchmarkSnapshots } from "@/modules/benchmarks/benchmarks.server";
import { refreshOperationAlerts } from "@/modules/analytics/alert-engine.server";
import { computeRfmSegments } from "@/modules/retention/rfm-calculator.server";
import { refreshExpiredTokens } from "@/modules/integrations/refresh-tokens.server";
import {
  processAutomationEnrollments,
  attributeConversions,
} from "@/modules/retention/sequence-runner.server";
import { runRetentionCrons } from "@/modules/retention/trigger-crons.server";
import { checkSlaAlerts } from "@/modules/logistics/sla/sla-engine.server";
import { syncAllTracking } from "@/modules/logistics/shipping/tracking-sync.server";
import { forecastVolumeFromCampaigns } from "@/modules/logistics/forecast/volume-forecast.server";
import { checkMinStockAlerts } from "@/modules/logistics/wms/stock-movements.server";
import { supabaseAdmin as adminClient } from "@/integrations/supabase/client.server";

export type CronJobName =
  | "health-recalc"
  | "sync-campaigns"
  | "sync-catalog"
  | "cleanup-oauth"
  | "process-outbox"
  | "capture-benchmarks"
  | "check-alerts"
  | "compute-rfm"
  | "refresh-tokens"
  | "process-automation-enrollments"
  | "retention-crons"
  | "attribute-conversions"
  | "check-sla"
  | "sync-tracking"
  | "forecast-volume"
  | "check-stock-alerts"
  | "stock-sync-outbox"
  | "schedule-pickup"
  | "sync-return-tracking"
  | "check-marketplace-penalties"
  | "sla-monthly-report"
  | "charge-fulfillment-overage"
  | "attribute-traffic-conversions"
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
      case "process-outbox":
        metadata = await processOutboxBatch();
        break;
      case "capture-benchmarks": {
        const snapshots = await captureBenchmarkSnapshots();
        metadata = { snapshots };
        break;
      }
      case "check-alerts": {
        const { data: clients } = await supabaseAdmin
          .from("clients")
          .select("id")
          .eq("status", "active");
        let checked = 0;
        for (const c of clients ?? []) {
          try {
            await refreshOperationAlerts(c.id);
            checked += 1;
          } catch (err) {
            console.error(`[check-alerts] client ${c.id} failed:`, err);
          }
        }
        metadata = { checked };
        break;
      }
      case "compute-rfm": {
        const result = await computeRfmSegments();
        metadata = result;
        break;
      }
      case "refresh-tokens": {
        const result = await refreshExpiredTokens();
        metadata = result;
        break;
      }
      case "process-automation-enrollments": {
        const run = await processAutomationEnrollments();
        metadata = run;
        break;
      }
      case "retention-crons": {
        metadata = await runRetentionCrons();
        break;
      }
      case "attribute-conversions": {
        metadata = await attributeConversions();
        break;
      }
      case "check-sla": {
        metadata = await checkSlaAlerts();
        break;
      }
      case "sync-tracking": {
        metadata = await syncAllTracking();
        break;
      }
      case "forecast-volume": {
        metadata = await forecastVolumeFromCampaigns();
        break;
      }
      case "check-stock-alerts": {
        const { data: clients } = await adminClient
          .from("clients")
          .select("id")
          .eq("status", "active");
        let critical = 0;
        let ruptureRisk = 0;
        const { predictStockRupture } = await import(
          "@/modules/logistics/wms/stock-rupture.server"
        );
        for (const c of clients ?? []) {
          const skus = await checkMinStockAlerts(c.id);
          critical += skus.length;
          const forecasts = await predictStockRupture(c.id);
          ruptureRisk += forecasts.filter((f) => f.risk === "critico").length;
        }
        metadata = { critical, ruptureRisk };
        break;
      }
      case "stock-sync-outbox": {
        const { processStockSyncOutbox } = await import(
          "@/modules/catalog/stock-sync-outbox.server"
        );
        metadata = await processStockSyncOutbox();
        break;
      }
      case "schedule-pickup": {
        const { checkScheduledPickup } = await import(
          "@/modules/logistics/shipping/pickup-scheduler.server"
        );
        metadata = await checkScheduledPickup();
        break;
      }
      case "sync-return-tracking": {
        const { syncAllReturnTracking } = await import(
          "@/modules/logistics/shipping/return-tracking-sync.server"
        );
        metadata = await syncAllReturnTracking();
        break;
      }
      case "check-marketplace-penalties": {
        const { checkMarketplacePenalties } = await import(
          "@/modules/logistics/sla/marketplace-penalties.server"
        );
        metadata = await checkMarketplacePenalties();
        break;
      }
      case "sla-monthly-report": {
        const { runMonthlySlaReportJob } = await import(
          "@/modules/logistics/sla/sla-report.server"
        );
        metadata = await runMonthlySlaReportJob();
        break;
      }
      case "charge-fulfillment-overage": {
        const { runFulfillmentOverageJob } = await import(
          "@/modules/billing/fulfillment-billing.server"
        );
        metadata = await runFulfillmentOverageJob();
        break;
      }
      case "attribute-traffic-conversions": {
        const { attributeTrafficConversionsBatch } = await import(
          "@/modules/traffic/order-attribution.server"
        );
        metadata = await attributeTrafficConversionsBatch();
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
  "process-outbox",
  "stock-sync-outbox",
  "process-automation-enrollments",
  "refresh-tokens",
  "health-recalc",
  "check-alerts",
  "check-sla",
  "check-marketplace-penalties",
  "sync-tracking",
  "sync-return-tracking",
  "sync-campaigns",
  "sync-catalog",
  "compute-rfm",
  "retention-crons",
  "attribute-conversions",
  "forecast-volume",
  "check-stock-alerts",
  "schedule-pickup",
  "charge-fulfillment-overage",
  "attribute-traffic-conversions",
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
