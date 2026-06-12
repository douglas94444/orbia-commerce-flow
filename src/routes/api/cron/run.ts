import { createFileRoute } from "@tanstack/react-router";
import { getServerConfig } from "@/lib/config.server";
import { runCronJob, type CronJobName } from "@/modules/jobs/scheduler.server";

const VALID_JOBS = new Set<CronJobName>([
  "health-recalc",
  "sync-campaigns",
  "sync-catalog",
  "cleanup-oauth",
  "process-outbox",
  "capture-benchmarks",
  "check-alerts",
  "compute-rfm",
  "refresh-tokens",
  "process-automation-enrollments",
  "retention-crons",
  "attribute-conversions",
  "check-sla",
  "sync-tracking",
  "forecast-volume",
  "check-stock-alerts",
  "stock-sync-outbox",
  "schedule-pickup",
  "sync-return-tracking",
  "check-marketplace-penalties",
  "sla-monthly-report",
  "charge-fulfillment-overage",
  "attribute-traffic-conversions",
  "all",
]);

export const Route = createFileRoute("/api/cron/run")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { cron } = getServerConfig();
        const secret = cron.secret;

        if (!secret) {
          return new Response("CRON_SECRET not configured", { status: 503 });
        }

        const auth = request.headers.get("authorization");
        if (auth !== `Bearer ${secret}`) {
          return new Response("Unauthorized", { status: 401 });
        }

        let body: { job?: string };
        try {
          body = await request.json();
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const job = (body.job ?? "all") as CronJobName;
        if (!VALID_JOBS.has(job)) {
          return new Response(`Unknown job: ${body.job}`, { status: 400 });
        }

        try {
          const results = await runCronJob(job);
          return Response.json({ ok: true, results });
        } catch (err) {
          console.error("[cron/run] error:", err);
          return new Response("Job failed", { status: 500 });
        }
      },
    },
  },
});
