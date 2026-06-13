import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { PLAN_ORDER_LIMITS, type PlanTier } from "@/shared/constants/plans";

const COMMERCIAL_TASKS: Array<{
  week: number;
  taskKey: string;
  title: string;
  responsible: "orbia" | "merchant";
  dependsOnKey?: string;
}> = [
  { week: 1, taskKey: "kickoff", title: "Reunião de kickoff (D+1)", responsible: "orbia" },
  { week: 1, taskKey: "access_platform", title: "Acesso ao portal Orbia", responsible: "merchant" },
  { week: 1, taskKey: "connect_channels", title: "Conectar canais de venda", responsible: "merchant", dependsOnKey: "access_platform" },
  { week: 2, taskKey: "traffic_audit", title: "Auditoria de tráfego", responsible: "orbia", dependsOnKey: "connect_channels" },
  { week: 2, taskKey: "catalog_review", title: "Revisão de catálogo", responsible: "merchant" },
  { week: 3, taskKey: "fiscal_setup", title: "Configuração fiscal", responsible: "merchant" },
  { week: 3, taskKey: "retention_flows", title: "Ativar fluxos de retenção", responsible: "orbia", dependsOnKey: "fiscal_setup" },
  { week: 4, taskKey: "go_live", title: "Go-live operação completa", responsible: "orbia" },
  { week: 4, taskKey: "weekly_checkin", title: "Check-in semanal WhatsApp", responsible: "orbia" },
];

export async function ensureCommercialOnboarding(
  clientId: string,
  prospectId?: string,
): Promise<void> {
  const { count } = await supabaseAdmin
    .from("sales_commercial_onboarding")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId);

  if ((count ?? 0) > 0) return;

  const dueBase = Date.now();
  const rows = COMMERCIAL_TASKS.map((t, i) => ({
    client_id: clientId,
    prospect_id: prospectId ?? null,
    week: t.week,
    task_key: t.taskKey,
    title: t.title,
    responsible: t.responsible,
    depends_on_key: t.dependsOnKey ?? null,
    due_at: new Date(dueBase + (t.week * 7 + i) * 86400000).toISOString(),
  }));

  await supabaseAdmin.from("sales_commercial_onboarding").insert(rows);
}

export async function getCommercialOnboardingProgress(clientId: string) {
  const { data } = await supabaseAdmin
    .from("sales_commercial_onboarding")
    .select("*")
    .eq("client_id", clientId)
    .order("week")
    .order("task_key");

  const tasks = data ?? [];
  const done = tasks.filter((t) => t.is_done).length;
  const total = tasks.length;
  const byWeek = [1, 2, 3, 4].map((week) => {
    const weekTasks = tasks.filter((t) => t.week === week);
    const weekDone = weekTasks.filter((t) => t.is_done).length;
    return {
      week,
      progressPercent: weekTasks.length ? Math.round((weekDone / weekTasks.length) * 100) : 0,
      tasks: weekTasks,
    };
  });

  const overdue = tasks.filter(
    (t) => !t.is_done && t.due_at && new Date(t.due_at) < new Date(),
  ).length;

  return {
    overallPercent: total ? Math.round((done / total) * 100) : 0,
    byWeek,
    overdue,
    tasks,
  };
}

export async function completeCommercialTask(
  clientId: string,
  taskKey: string,
  blockerNote?: string,
): Promise<void> {
  await supabaseAdmin
    .from("sales_commercial_onboarding")
    .update({
      is_done: !blockerNote,
      blocker_note: blockerNote ?? null,
      completed_at: blockerNote ? null : new Date().toISOString(),
    })
    .eq("client_id", clientId)
    .eq("task_key", taskKey);
}

export async function getAvgOnboardingDaysByPlan(): Promise<
  Record<PlanTier, number>
> {
  const { data } = await supabaseAdmin
    .from("clients")
    .select("plan, created_at, status")
    .eq("status", "active");

  const result: Record<string, number[]> = { launch: [], growth: [], scale: [] };
  for (const c of data ?? []) {
    const days = Math.floor((Date.now() - new Date(c.created_at).getTime()) / 86400000);
    if (days > 0 && days < 120) result[c.plan]?.push(days);
  }

  return {
    launch: avg(result.launch) || 28,
    growth: avg(result.growth) || 25,
    scale: avg(result.scale) || 22,
  };
}

function avg(nums: number[]): number {
  return nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : 0;
}

export { PLAN_ORDER_LIMITS };
