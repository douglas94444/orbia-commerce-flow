import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logAudit } from "@/shared/lib/logger";
import { assignProspectRoundRobin } from "./assignment.server";
import { computeLeadScore, getStageIdByKey } from "./lead-scoring.server";
import { requireStaff } from "./staff-auth.server";

// ─── Types ───────────────────────────────────────────────────

export interface PipelineStage {
  id: string;
  stageKey: string;
  label: string;
  position: number;
  color: string;
}

export interface SalesProspectRow {
  id: string;
  companyName: string;
  contactName: string;
  email: string;
  phone: string | null;
  platform: string | null;
  monthlyRevenueCents: number;
  adSpendCents: number;
  mainPain: string | null;
  segment: string;
  qualificationScore: number;
  bantBudget: number;
  bantAuthority: number;
  bantNeed: number;
  bantTimeline: number;
  temperature: string;
  stageId: string;
  stageKey: string;
  stageLabel: string;
  assignedStaffId: string | null;
  assignedStaffName: string | null;
  source: string;
  referralCode: string | null;
  convertedClientId: string | null;
  lastInteractionAt: string | null;
  createdAt: string;
}

export interface SalesInteractionRow {
  id: string;
  kind: string;
  channel: string | null;
  notes: string | null;
  staffName: string | null;
  occurredAt: string;
  metadata: Record<string, unknown>;
}

export interface SalesTaskRow {
  id: string;
  title: string;
  dueAt: string;
  completedAt: string | null;
  priority: string;
  assignedStaffName: string | null;
}

function mapProspect(
  row: Record<string, unknown>,
  stage?: { stage_key: string; label: string } | null,
  staff?: { full_name?: string | null } | null,
): SalesProspectRow {
  const s = stage ?? (row.sales_pipeline_stages as { stage_key: string; label: string } | null);
  const st = staff ?? (row.profiles as { full_name?: string | null } | null);
  return {
    id: row.id as string,
    companyName: row.company_name as string,
    contactName: row.contact_name as string,
    email: row.email as string,
    phone: row.phone as string | null,
    platform: row.platform as string | null,
    monthlyRevenueCents: Number(row.monthly_revenue_cents),
    adSpendCents: Number(row.ad_spend_cents),
    mainPain: row.main_pain as string | null,
    segment: row.segment as string,
    qualificationScore: row.qualification_score as number,
    bantBudget: row.bant_budget as number,
    bantAuthority: row.bant_authority as number,
    bantNeed: row.bant_need as number,
    bantTimeline: row.bant_timeline as number,
    temperature: row.temperature as string,
    stageId: row.stage_id as string,
    stageKey: s?.stage_key ?? "",
    stageLabel: s?.label ?? "",
    assignedStaffId: row.assigned_staff_id as string | null,
    assignedStaffName: (st?.full_name as string | null) ?? null,
    source: row.source as string,
    referralCode: row.referral_code as string | null,
    convertedClientId: row.converted_client_id as string | null,
    lastInteractionAt: row.last_interaction_at as string | null,
    createdAt: row.created_at as string,
  };
}

// ─── Pipeline stages ─────────────────────────────────────────

export const listPipelineStages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PipelineStage[]> => {
    await requireStaff(context.userId, context.supabase);
    const { data } = await supabaseAdmin
      .from("sales_pipeline_stages")
      .select("*")
      .order("position");
    return (data ?? []).map((s) => ({
      id: s.id,
      stageKey: s.stage_key,
      label: s.label,
      position: s.position,
      color: s.color,
    }));
  });

// ─── List prospects ──────────────────────────────────────────

const listProspectsSchema = z.object({
  stageId: z.string().uuid().optional(),
  source: z.string().optional(),
  temperature: z.enum(["cold", "warm", "hot"]).optional(),
  assignedStaffId: z.string().uuid().optional(),
  search: z.string().optional(),
});

export const listProspects = createServerFn({ method: "GET" })
  .inputValidator(listProspectsSchema.optional())
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }): Promise<SalesProspectRow[]> => {
    await requireStaff(context.userId, context.supabase);

    let q = supabaseAdmin
      .from("sales_prospects")
      .select("*, sales_pipeline_stages(stage_key, label), profiles:assigned_staff_id(full_name)")
      .order("created_at", { ascending: false });

    if (data?.stageId) q = q.eq("stage_id", data.stageId);
    if (data?.source) q = q.eq("source", data.source);
    if (data?.temperature) q = q.eq("temperature", data.temperature);
    if (data?.assignedStaffId) q = q.eq("assigned_staff_id", data.assignedStaffId);
    if (data?.search) {
      q = q.or(
        `company_name.ilike.%${data.search}%,contact_name.ilike.%${data.search}%,email.ilike.%${data.search}%`,
      );
    }

    const { data: rows, error } = await q.limit(200);
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => mapProspect(r as Record<string, unknown>));
  });

// ─── Get prospect detail ─────────────────────────────────────

const prospectIdSchema = z.object({ prospectId: z.string().uuid() });

export const getProspect = createServerFn({ method: "GET" })
  .inputValidator(prospectIdSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId, context.supabase);

    const [prospectRes, interactionsRes, tasksRes, eventsRes] = await Promise.all([
      supabaseAdmin
        .from("sales_prospects")
        .select("*, sales_pipeline_stages(stage_key, label), profiles:assigned_staff_id(full_name)")
        .eq("id", data.prospectId)
        .single(),
      supabaseAdmin
        .from("sales_interactions")
        .select("*, profiles:staff_id(full_name)")
        .eq("prospect_id", data.prospectId)
        .order("occurred_at", { ascending: false })
        .limit(50),
      supabaseAdmin
        .from("sales_tasks")
        .select("*, profiles:assigned_staff_id(full_name)")
        .eq("prospect_id", data.prospectId)
        .order("due_at"),
      supabaseAdmin
        .from("sales_prospect_events")
        .select("*")
        .eq("prospect_id", data.prospectId)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    if (prospectRes.error) throw new Error(prospectRes.error.message);

    const interactions: SalesInteractionRow[] = (interactionsRes.data ?? []).map((i) => ({
      id: i.id,
      kind: i.kind,
      channel: i.channel,
      notes: i.notes,
      staffName: (i.profiles as { full_name?: string } | null)?.full_name ?? null,
      occurredAt: i.occurred_at,
      metadata: (i.metadata as Record<string, unknown>) ?? {},
    }));

    const tasks: SalesTaskRow[] = (tasksRes.data ?? []).map((t) => ({
      id: t.id,
      title: t.title,
      dueAt: t.due_at,
      completedAt: t.completed_at,
      priority: t.priority,
      assignedStaffName: (t.profiles as { full_name?: string } | null)?.full_name ?? null,
    }));

    return {
      prospect: mapProspect(prospectRes.data as Record<string, unknown>),
      interactions,
      tasks,
      events: eventsRes.data ?? [],
    };
  });

// ─── Create prospect (staff) ─────────────────────────────────

const createProspectSchema = z.object({
  companyName: z.string().min(2),
  contactName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  platform: z.string().optional(),
  monthlyRevenueCents: z.number().int().min(0).default(0),
  adSpendCents: z.number().int().min(0).default(0),
  mainPain: z.string().optional(),
  segment: z.string().default("Geral"),
  isDecisionMaker: z.boolean().default(false),
  urgency: z.enum(["now", "30d", "90d", "exploring"]).optional(),
  source: z
    .enum(["inbound", "partner", "paid_ads", "app_store", "content", "referral", "chatbot"])
    .default("inbound"),
  referralCode: z.string().optional(),
  assignedStaffId: z.string().uuid().optional(),
});

export const createProspectStaff = createServerFn({ method: "POST" })
  .inputValidator(createProspectSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId, context.supabase);

    const score = computeLeadScore({
      monthlyRevenueCents: data.monthlyRevenueCents,
      adSpendCents: data.adSpendCents,
      isDecisionMaker: data.isDecisionMaker,
      mainPain: data.mainPain ?? null,
      urgency: data.urgency ?? null,
      platform: data.platform ?? null,
    });

    const stageId = await getStageIdByKey("captured");
    const assignedStaffId = data.assignedStaffId ?? (await assignProspectRoundRobin());

    const { data: row, error } = await supabaseAdmin
      .from("sales_prospects")
      .insert({
        company_name: data.companyName,
        contact_name: data.contactName,
        email: data.email,
        phone: data.phone,
        whatsapp: data.whatsapp,
        platform: data.platform,
        monthly_revenue_cents: data.monthlyRevenueCents,
        ad_spend_cents: data.adSpendCents,
        main_pain: data.mainPain,
        segment: data.segment,
        is_decision_maker: data.isDecisionMaker,
        urgency: data.urgency,
        source: data.source,
        referral_code: data.referralCode,
        stage_id: stageId,
        assigned_staff_id: assignedStaffId,
        qualification_score: score.qualificationScore,
        bant_budget: score.bantBudget,
        bant_authority: score.bantAuthority,
        bant_need: score.bantNeed,
        bant_timeline: score.bantTimeline,
        temperature: score.temperature,
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);

    await logAudit({
      user_id: context.userId,
      action: "create",
      resource: "sales_prospect",
      resource_id: row.id,
    });

    return { id: row.id };
  });

// ─── Move stage ──────────────────────────────────────────────

const moveStageSchema = z.object({
  prospectId: z.string().uuid(),
  stageKey: z.string(),
  notes: z.string().optional(),
});

export const moveProspectStage = createServerFn({ method: "POST" })
  .inputValidator(moveStageSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId, context.supabase);
    const stageId = await getStageIdByKey(data.stageKey);

    const { error } = await supabaseAdmin
      .from("sales_prospects")
      .update({ stage_id: stageId, updated_at: new Date().toISOString() })
      .eq("id", data.prospectId);

    if (error) throw new Error(error.message);

    await supabaseAdmin.from("sales_interactions").insert({
      prospect_id: data.prospectId,
      staff_id: context.userId,
      kind: "stage_change",
      notes: data.notes ?? `Movido para ${data.stageKey}`,
      metadata: { stage_key: data.stageKey },
    });

    await logAudit({
      user_id: context.userId,
      action: "update",
      resource: "sales_prospect",
      resource_id: data.prospectId,
      metadata: { stage_key: data.stageKey },
    });

    return { ok: true };
  });

// ─── Assign / transfer ───────────────────────────────────────

const assignSchema = z.object({
  prospectId: z.string().uuid(),
  staffId: z.string().uuid(),
  notes: z.string().optional(),
});

export const assignProspect = createServerFn({ method: "POST" })
  .inputValidator(assignSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId, context.supabase);

    const { error } = await supabaseAdmin
      .from("sales_prospects")
      .update({ assigned_staff_id: data.staffId })
      .eq("id", data.prospectId);

    if (error) throw new Error(error.message);

    await supabaseAdmin.from("sales_interactions").insert({
      prospect_id: data.prospectId,
      staff_id: context.userId,
      kind: "note",
      notes: data.notes ?? "Prospect transferido para outro CS.",
      metadata: { new_staff_id: data.staffId },
    });

    return { ok: true };
  });

// ─── Interactions ────────────────────────────────────────────

const addInteractionSchema = z.object({
  prospectId: z.string().uuid(),
  kind: z.enum(["email", "call", "meeting", "note", "proposal_sent", "objection"]),
  channel: z.string().optional(),
  notes: z.string().optional(),
});

export const addProspectInteraction = createServerFn({ method: "POST" })
  .inputValidator(addInteractionSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId, context.supabase);

    await supabaseAdmin.from("sales_interactions").insert({
      prospect_id: data.prospectId,
      staff_id: context.userId,
      kind: data.kind,
      channel: data.channel,
      notes: data.notes,
    });

    await supabaseAdmin
      .from("sales_prospects")
      .update({ last_interaction_at: new Date().toISOString() })
      .eq("id", data.prospectId);

    return { ok: true };
  });

// ─── Tasks ───────────────────────────────────────────────────

const createTaskSchema = z.object({
  prospectId: z.string().uuid(),
  title: z.string().min(2),
  dueAt: z.string(),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  assignedStaffId: z.string().uuid().optional(),
});

export const createProspectTask = createServerFn({ method: "POST" })
  .inputValidator(createTaskSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId, context.supabase);

    const { data: row, error } = await supabaseAdmin
      .from("sales_tasks")
      .insert({
        prospect_id: data.prospectId,
        title: data.title,
        due_at: data.dueAt,
        priority: data.priority,
        assigned_staff_id: data.assignedStaffId ?? context.userId,
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);
    return { id: row.id };
  });

const completeTaskSchema = z.object({ taskId: z.string().uuid() });

export const completeProspectTask = createServerFn({ method: "POST" })
  .inputValidator(completeTaskSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId, context.supabase);
    await supabaseAdmin
      .from("sales_tasks")
      .update({ completed_at: new Date().toISOString() })
      .eq("id", data.taskId);
    return { ok: true };
  });

// ─── Staff list for assignment ───────────────────────────────

export const listSalesStaff = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireStaff(context.userId, context.supabase);
    const { data } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, role")
      .in("role", ["orbia_admin", "orbia_staff"]);
    return (data ?? []).map((p) => ({
      id: p.id,
      name: p.full_name ?? "Staff",
      role: p.role,
    }));
  });

// ─── Funnel metrics ──────────────────────────────────────────

export const getSalesFunnelMetrics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireStaff(context.userId, context.supabase);
    const { data } = await supabaseAdmin.from("sales_funnel_metrics").select("*");
    return data ?? [];
  });

// ─── Recent prospect events (polling stub) ───────────────────

export const listRecentProspectEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireStaff(context.userId, context.supabase);
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data } = await supabaseAdmin
      .from("sales_prospect_events")
      .select("*, sales_prospects(company_name, contact_name)")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(30);
    return data ?? [];
  });
