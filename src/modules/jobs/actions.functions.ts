import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { runCronJob, type CronJobName } from "./scheduler.server";

async function requireStaff(
  userId: string,
  supabase: { from: (t: string) => ReturnType<import("@supabase/supabase-js").SupabaseClient["from"]> },
) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();
  if (!profile || !["orbia_admin", "orbia_staff"].includes(profile.role as string)) {
    throw new Error("Apenas equipe Orbia.");
  }
}

const jobSchema = z.object({
  job: z.enum(["health-recalc", "sync-campaigns", "sync-catalog", "cleanup-oauth", "process-outbox", "all"]).default("all"),
});

export const runScheduledJobs = createServerFn({ method: "POST" })
  .inputValidator(jobSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId, context.supabase);
    return runCronJob(data.job as CronJobName);
  });
