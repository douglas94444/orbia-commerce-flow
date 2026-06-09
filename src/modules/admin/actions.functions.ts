import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logAudit } from "@/shared/lib/logger";
import {
  ensureOnboardingTasks,
  maybeAdvanceOnboardingWeek,
  refreshClientLastContact,
} from "./admin.server";

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

export interface SuccessPortfolio {
  activeClients: number;
  avgHealth: number;
  avgNps90d: number | null;
  qbrsNext14d: number;
  criticalAlerts: number;
  staleContactClients: number;
}

export interface OnboardingPipelineItem {
  clientId: string;
  clientName: string;
  plan: string;
  onboardingWeek: number;
  progressPercent: number;
  tasksDone: number;
  tasksTotal: number;
}

export interface CsActivityRow {
  id: string;
  kind: string;
  channel: string | null;
  score: number | null;
  notes: string | null;
  occurredAt: string;
  staffName: string | null;
}

export const getSuccessPortfolio = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SuccessPortfolio> => {
    await requireStaff(context.userId, context.supabase);

    const { data: clients } = await supabaseAdmin
      .from("clients")
      .select("health_score, last_contact_days")
      .eq("status", "active");

    const activeClients = clients?.length ?? 0;
    const avgHealth =
      activeClients > 0
        ? Math.round(
            (clients ?? []).reduce((s, c) => s + (c.health_score ?? 0), 0) / activeClients,
          )
        : 0;

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const { data: npsRows } = await supabaseAdmin
      .from("cs_activities")
      .select("score")
      .eq("kind", "nps")
      .gte("occurred_at", ninetyDaysAgo.toISOString());

    const npsScores = (npsRows ?? []).map((r) => r.score).filter((s): s is number => s != null);
    const avgNps90d =
      npsScores.length > 0
        ? Number((npsScores.reduce((a, b) => a + b, 0) / npsScores.length).toFixed(1))
        : null;

    const in14d = new Date();
    in14d.setDate(in14d.getDate() + 14);

    const { count: qbrsNext14d } = await supabaseAdmin
      .from("cs_activities")
      .select("id", { count: "exact", head: true })
      .eq("kind", "qbr")
      .gte("occurred_at", new Date().toISOString())
      .lte("occurred_at", in14d.toISOString());

    const { count: criticalAlerts } = await supabaseAdmin
      .from("operation_alerts")
      .select("id", { count: "exact", head: true })
      .eq("is_resolved", false)
      .eq("severity", "critical");

    const staleContactClients = (clients ?? []).filter((c) => (c.last_contact_days ?? 0) > 14).length;

    return {
      activeClients,
      avgHealth,
      avgNps90d,
      qbrsNext14d: qbrsNext14d ?? 0,
      criticalAlerts: criticalAlerts ?? 0,
      staleContactClients,
    };
  });

export const getOnboardingPipeline = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<OnboardingPipelineItem[]> => {
    await requireStaff(context.userId, context.supabase);

    const { data: clients } = await supabaseAdmin
      .from("clients")
      .select("id, name, plan, onboarding_week, status")
      .eq("status", "active")
      .order("onboarding_week");

    const result: OnboardingPipelineItem[] = [];

    for (const client of clients ?? []) {
      const week = client.onboarding_week ?? 1;
      if (week >= 4) continue;

      await ensureOnboardingTasks(client.id);

      const { data: tasks } = await supabaseAdmin
        .from("onboarding_tasks")
        .select("is_done")
        .eq("client_id", client.id)
        .eq("week", week);

      const tasksTotal = tasks?.length ?? 0;
      const tasksDone = tasks?.filter((t) => t.is_done).length ?? 0;
      const progressPercent = tasksTotal > 0 ? Math.round((tasksDone / tasksTotal) * 100) : 0;

      result.push({
        clientId: client.id,
        clientName: client.name,
        plan: client.plan,
        onboardingWeek: week,
        progressPercent,
        tasksDone,
        tasksTotal,
      });
    }

    return result;
  });

export const getAtRiskClients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireStaff(context.userId, context.supabase);

    const { data } = await supabaseAdmin
      .from("clients")
      .select("id, name, plan, health_score, last_contact_days")
      .eq("status", "active")
      .lt("health_score", 50)
      .order("health_score");

    return (data ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      plan: c.plan,
      healthScore: c.health_score,
      lastContactDays: c.last_contact_days,
    }));
  });

const clientIdSchema = z.object({ clientId: z.string().uuid() });

export const listClientActivities = createServerFn({ method: "GET" })
  .inputValidator(clientIdSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }): Promise<CsActivityRow[]> => {
    await requireStaff(context.userId, context.supabase);

    const { data: rows, error } = await supabaseAdmin
      .from("cs_activities")
      .select("id, kind, channel, score, notes, occurred_at, profiles(full_name)")
      .eq("client_id", data.clientId)
      .order("occurred_at", { ascending: false })
      .limit(20);

    if (error) throw new Error(error.message);

    return (rows ?? []).map(
      (r: {
        id: string;
        kind: string;
        channel: string | null;
        score: number | null;
        notes: string | null;
        occurred_at: string;
        profiles: { full_name: string | null } | null;
      }) => ({
        id: r.id,
        kind: r.kind,
        channel: r.channel,
        score: r.score,
        notes: r.notes,
        occurredAt: r.occurred_at,
        staffName: r.profiles?.full_name ?? null,
      }),
    );
  });

export const listClientOnboardingTasks = createServerFn({ method: "GET" })
  .inputValidator(clientIdSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId, context.supabase);
    await ensureOnboardingTasks(data.clientId);

    const { data: client } = await supabaseAdmin
      .from("clients")
      .select("onboarding_week")
      .eq("id", data.clientId)
      .single();

    const week = client?.onboarding_week ?? 1;

    const { data: tasks } = await supabaseAdmin
      .from("onboarding_tasks")
      .select("id, week, task_key, title, is_done")
      .eq("client_id", data.clientId)
      .eq("week", week)
      .order("task_key");

    return { onboardingWeek: week, tasks: tasks ?? [] };
  });

const logActivitySchema = z.object({
  clientId: z.string().uuid(),
  kind: z.enum(["contact", "qbr", "onboarding_note"]),
  channel: z.enum(["call", "email", "whatsapp", "meeting"]).optional(),
  notes: z.string().max(2000).optional(),
});

export const logCsActivity = createServerFn({ method: "POST" })
  .inputValidator(logActivitySchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId, context.supabase);

    const { error } = await supabaseAdmin.from("cs_activities").insert({
      client_id: data.clientId,
      staff_id: context.userId,
      kind: data.kind,
      channel: data.channel ?? null,
      notes: data.notes ?? null,
    });

    if (error) throw new Error(error.message);

    await refreshClientLastContact(data.clientId);

    await logAudit({
      user_id: context.userId,
      client_id: data.clientId,
      action: "create",
      resource: "cs_activity",
      new_data: { kind: data.kind },
    });

    return { ok: true };
  });

const npsSchema = z.object({
  clientId: z.string().uuid(),
  score: z.number().int().min(0).max(10),
  notes: z.string().max(500).optional(),
});

export const recordNps = createServerFn({ method: "POST" })
  .inputValidator(npsSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId, context.supabase);

    const { error } = await supabaseAdmin.from("cs_activities").insert({
      client_id: data.clientId,
      staff_id: context.userId,
      kind: "nps",
      score: data.score,
      notes: data.notes ?? null,
    });

    if (error) throw new Error(error.message);
    return { ok: true };
  });

const toggleTaskSchema = z.object({
  clientId: z.string().uuid(),
  taskId: z.string().uuid(),
  isDone: z.boolean(),
});

export const toggleOnboardingTask = createServerFn({ method: "POST" })
  .inputValidator(toggleTaskSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId, context.supabase);

    const { data: task, error } = await supabaseAdmin
      .from("onboarding_tasks")
      .update({
        is_done: data.isDone,
        completed_at: data.isDone ? new Date().toISOString() : null,
      })
      .eq("id", data.taskId)
      .eq("client_id", data.clientId)
      .select("week")
      .single();

    if (error) throw new Error(error.message);

    if (data.isDone && task?.week) {
      await maybeAdvanceOnboardingWeek(data.clientId, task.week);
    }

    return { ok: true };
  });

const alertIdSchema = z.object({ alertId: z.string().uuid() });

export const resolveOperationAlert = createServerFn({ method: "POST" })
  .inputValidator(alertIdSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId, context.supabase);

    const { error } = await supabaseAdmin
      .from("operation_alerts")
      .update({ is_resolved: true })
      .eq("id", data.alertId);

    if (error) throw new Error(error.message);
    return { ok: true };
  });
