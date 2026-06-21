import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logAudit } from "@/shared/lib/logger";
import { buildContractClauses, buildContractHtml, defaultMonthlyCents } from "./contracts/contract-templates.server";
import { buildProposalContent } from "./proposals/proposal-builder.server";
import { scheduleProposalFollowUp } from "./nurture.server";
import { getStageIdByKey } from "./lead-scoring.server";
import { requireStaff } from "./staff-auth.server";
import { computeSalesMetrics } from "./metrics/sales-metrics.server";
import { getPartnerDashboard, getPartnerRanking, computePartnerTier } from "./partners/partners.server";
import { listUpsellOpportunities, scanUpsellOpportunities } from "./upsell/upsell-engine.server";
import { getCommercialOnboardingProgress } from "./onboarding/commercial-onboarding.server";
import { getCampaignDiagnostics, saveProspectMetaOAuth } from "./traffic-diagnostics.server";
import type { Json } from "@/integrations/supabase/types";

// ─── Create proposal ─────────────────────────────────────────

const createProposalSchema = z.object({
  prospectId: z.string().uuid(),
  validDays: z.number().int().min(1).max(30).default(7),
});

export const createProposal = createServerFn({ method: "POST" })
  .inputValidator(createProposalSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId, context.supabase);

    const { data: prospect } = await supabaseAdmin
      .from("sales_prospects")
      .select("*")
      .eq("id", data.prospectId)
      .single();

    if (!prospect) throw new Error("Prospect não encontrado.");

    const { data: diagnosis } = await supabaseAdmin
      .from("sales_diagnoses")
      .select("*")
      .eq("prospect_id", data.prospectId)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const content = await buildProposalContent(
      prospect,
      diagnosis
        ? {
            overallScore: diagnosis.overall_score,
            dimensions: diagnosis.dimensions as never[],
            gaps: diagnosis.gaps as never[],
            potentialGrowthPct: Number(diagnosis.potential_growth_pct),
            narrative: diagnosis.narrative ?? "",
          }
        : null,
    );

    const validUntil = new Date(Date.now() + data.validDays * 86400000).toISOString();

    const { data: lastVersion } = await supabaseAdmin
      .from("sales_proposals")
      .select("version")
      .eq("prospect_id", data.prospectId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    const version = (lastVersion?.version ?? 0) + 1;

    const { data: proposal, error } = await supabaseAdmin
      .from("sales_proposals")
      .insert({
        prospect_id: data.prospectId,
        recommended_plan: content.recommendedPlan,
        roi_params: content.roiParams,
        content: content as Json,
        valid_until: validUntil,
        version,
        status: "sent",
        sent_at: new Date().toISOString(),
        created_by: context.userId,
      })
      .select("id, public_token")
      .single();

    if (error) throw new Error(error.message);

    const stageId = await getStageIdByKey("proposal_sent");
    await supabaseAdmin
      .from("sales_prospects")
      .update({ stage_id: stageId })
      .eq("id", data.prospectId);

    await supabaseAdmin.from("sales_interactions").insert({
      prospect_id: data.prospectId,
      staff_id: context.userId,
      kind: "proposal_sent",
      notes: `Proposta v${version} enviada`,
      metadata: { proposal_id: proposal.id, token: proposal.public_token },
    });

    await scheduleProposalFollowUp(data.prospectId);

    await logAudit({
      user_id: context.userId,
      action: "create",
      resource: "sales_proposal",
      resource_id: proposal.id,
    });

    return { id: proposal.id, publicToken: proposal.public_token, content };
  });

// ─── Create contract ───────────────────────────────────────────

const createContractSchema = z.object({
  prospectId: z.string().uuid(),
  proposalId: z.string().uuid().optional(),
  plan: z.enum(["launch", "growth", "scale"]).optional(),
  customClauses: z.array(z.string()).optional(),
  validDays: z.number().int().default(14),
});

export const createContract = createServerFn({ method: "POST" })
  .inputValidator(createContractSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId, context.supabase);

    const { data: prospect } = await supabaseAdmin
      .from("sales_prospects")
      .select("*")
      .eq("id", data.prospectId)
      .single();

    if (!prospect) throw new Error("Prospect não encontrado.");

    let plan = data.plan;
    if (!plan && data.proposalId) {
      const { data: proposal } = await supabaseAdmin
        .from("sales_proposals")
        .select("recommended_plan")
        .eq("id", data.proposalId)
        .single();
      plan = proposal?.recommended_plan as typeof plan;
    }
    if (!plan) plan = "launch";

    const clauses = buildContractClauses(plan);
    if (data.customClauses?.length) clauses.customClauses = data.customClauses;

    const monthlyCents = defaultMonthlyCents(plan);
    const html = buildContractHtml(
      prospect.company_name,
      prospect.contact_name,
      plan,
      monthlyCents,
      clauses,
    );

    const { data: contract, error } = await supabaseAdmin
      .from("sales_contracts")
      .insert({
        prospect_id: data.prospectId,
        proposal_id: data.proposalId,
        plan,
        monthly_cents: monthlyCents,
        clauses: { ...clauses, html },
        valid_until: new Date(Date.now() + data.validDays * 86400000).toISOString(),
        status: "pending",
      })
      .select("id, public_token")
      .single();

    if (error) throw new Error(error.message);

    const stageId = await getStageIdByKey("negotiation");
    await supabaseAdmin
      .from("sales_prospects")
      .update({ stage_id: stageId })
      .eq("id", data.prospectId);

    return { id: contract.id, publicToken: contract.public_token };
  });

// ─── Partners (staff) ────────────────────────────────────────

export const listPartners = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireStaff(context.userId, context.supabase);
    const { data } = await supabaseAdmin
      .from("sales_partners")
      .select("*")
      .order("created_at", { ascending: false });
    return data ?? [];
  });

const partnerIdSchema = z.object({ partnerId: z.string().uuid() });

export const getPartnerDashboardFn = createServerFn({ method: "GET" })
  .inputValidator(partnerIdSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId, context.supabase);
    return getPartnerDashboard(data.partnerId);
  });

export const getPartnerRankingFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireStaff(context.userId, context.supabase);
    return getPartnerRanking();
  });

export const activatePartner = createServerFn({ method: "POST" })
  .inputValidator(partnerIdSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId, context.supabase);
    await supabaseAdmin
      .from("sales_partners")
      .update({ status: "active" })
      .eq("id", data.partnerId);
    await computePartnerTier(data.partnerId);
    return { ok: true };
  });

// ─── Metrics ─────────────────────────────────────────────────

export const getSalesMetrics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireStaff(context.userId, context.supabase);
    return computeSalesMetrics();
  });

export const runUpsellScan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireStaff(context.userId, context.supabase);
    const created = await scanUpsellOpportunities();
    return { created };
  });

export const listUpsellOpportunitiesFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireStaff(context.userId, context.supabase);
    return listUpsellOpportunities();
  });

// ─── Commercial onboarding ─────────────────────────────────────

const clientIdSchema = z.object({ clientId: z.string().uuid() });

export const getCommercialOnboardingFn = createServerFn({ method: "GET" })
  .inputValidator(clientIdSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId, context.supabase);
    return getCommercialOnboardingProgress(data.clientId);
  });

// ─── Meta diagnostics for prospect ─────────────────────────────

const prospectMetaSchema = z.object({
  prospectId: z.string().uuid(),
  accessToken: z.string().optional(),
  accountId: z.string().optional(),
});

export const getProspectMetaDiagnostics = createServerFn({ method: "GET" })
  .inputValidator(prospectMetaSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId, context.supabase);

    if (data.accessToken && data.accountId) {
      await saveProspectMetaOAuth(data.prospectId, data.accessToken, data.accountId);
    }

    return getCampaignDiagnostics(data.prospectId);
  });

// ─── Enroll cold nurture ───────────────────────────────────────

const coldNurtureSchema = z.object({ prospectId: z.string().uuid() });

export const enrollColdNurtureFn = createServerFn({ method: "POST" })
  .inputValidator(coldNurtureSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId, context.supabase);
    const { enrollColdNurture } = await import("./nurture.server");
    await enrollColdNurture(data.prospectId);
    return { ok: true };
  });
