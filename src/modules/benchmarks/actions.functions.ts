import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { captureBenchmarkSnapshots } from "./benchmarks.server";

export const getBenchmarkSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("benchmark_snapshots")
      .select("metric_key, value, portfolio_avg, portfolio_p75, ai_summary, snapshot_at, clients(name)")
      .order("snapshot_at", { ascending: false })
      .limit(20);

    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const runBenchmarkCapture = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("role")
      .eq("id", context.userId)
      .single();
    if (!profile || !["orbia_admin", "orbia_staff"].includes(profile.role as string)) {
      throw new Error("Apenas equipe Orbia.");
    }
    const snapshots = await captureBenchmarkSnapshots();
    return { snapshots };
  });
