import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createPreference } from "@/integrations/mercado-pago";
import { getServerConfig } from "@/lib/config.server";
import { emitDomainEvent } from "@/shared/lib/domain-events.server";
import { logJob, startTimer } from "@/shared/lib/logger";
import { DIAGNOSTIC_TRIPWIRE_CENTS } from "@/shared/constants/plans";
import { assignProspectRoundRobin } from "./assignment.server";
import { runDiagnosisEngine, saveDiagnosis } from "./diagnosis/diagnosis-engine.server";
import { buildDiagnosticPdf, pdfToBase64 } from "./diagnosis/diagnostic-pdf.server";
import { computeLeadScore, getCapturedStageId, getStageIdByKey } from "./lead-scoring.server";
import { resolvePartnerByReferral } from "./partners/partners.server";
import { getCampaignDiagnostics } from "./traffic-diagnostics.server";
import type { Json } from "@/integrations/supabase/types";

// ─── Submit diagnostic form (public) ─────────────────────────

const diagnosticFormSchema = z.object({
  companyName: z.string().min(2),
  contactName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  platform: z.string().optional(),
  monthlyRevenueCents: z.number().int().min(0),
  adSpendCents: z.number().int().min(0),
  mainPain: z.string().optional(),
  segment: z.string().default("Geral"),
  isDecisionMaker: z.boolean().default(false),
  urgency: z.enum(["now", "30d", "90d", "exploring"]).optional(),
  fulfillmentType: z.enum(["own", "third_party"]).optional(),
  hasEmailAutomation: z.boolean().optional(),
  hasWhatsappAutomation: z.boolean().optional(),
  referralCode: z.string().optional(),
  utmSource: z.string().optional(),
  utmMedium: z.string().optional(),
  utmCampaign: z.string().optional(),
  source: z
    .enum(["inbound", "partner", "paid_ads", "app_store", "content", "referral", "chatbot"])
    .default("inbound"),
});

export const submitDiagnosticForm = createServerFn({ method: "POST" })
  .inputValidator(diagnosticFormSchema)
  .handler(async ({ data }) => {
    const end = startTimer();
    const score = computeLeadScore({
      monthlyRevenueCents: data.monthlyRevenueCents,
      adSpendCents: data.adSpendCents,
      isDecisionMaker: data.isDecisionMaker,
      mainPain: data.mainPain ?? null,
      urgency: data.urgency ?? null,
      platform: data.platform ?? null,
    });

    let partnerId: string | null = null;
    let source = data.source;
    if (data.referralCode) {
      const partner = await resolvePartnerByReferral(data.referralCode);
      if (partner) {
        partnerId = partner.id;
        source = "partner";
      }
    }

    const stageId = await getCapturedStageId();
    const assignedStaffId = await assignProspectRoundRobin();

    const { data: prospect, error } = await supabaseAdmin
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
        source,
        referral_code: data.referralCode,
        partner_id: partnerId,
        utm_source: data.utmSource,
        utm_medium: data.utmMedium,
        utm_campaign: data.utmCampaign,
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

    const diagnosis = await runDiagnosisEngine({
      platform: data.platform ?? null,
      monthlyRevenueCents: data.monthlyRevenueCents,
      adSpendCents: data.adSpendCents,
      mainPain: data.mainPain ?? null,
      segment: data.segment,
      fulfillmentType: data.fulfillmentType ?? null,
      hasEmailAutomation: data.hasEmailAutomation,
      hasWhatsappAutomation: data.hasWhatsappAutomation,
    });

    const saved = await saveDiagnosis(prospect.id, diagnosis);

    const diagnosisStageId = await getStageIdByKey("diagnosis_sent");
    await supabaseAdmin
      .from("sales_prospects")
      .update({ stage_id: diagnosisStageId })
      .eq("id", prospect.id);

    await emitDomainEvent("prospect.created", {
      prospectId: prospect.id,
      email: data.email,
      segment: data.segment,
      temperature: score.temperature,
    });

    await logJob({
      job_type: "diagnostic_form",
      job_id: prospect.id,
      status: "completed",
      duration_ms: end(),
    });

    return {
      prospectId: prospect.id,
      publicToken: saved.publicToken,
      overallScore: diagnosis.overallScore,
      potentialGrowthPct: diagnosis.potentialGrowthPct,
      narrative: diagnosis.narrative,
      gaps: diagnosis.gaps,
      dimensions: diagnosis.dimensions,
    };
  });

// ─── Get diagnosis result (public) ───────────────────────────

const tokenSchema = z.object({ token: z.string().min(8) });

export const getDiagnosticResult = createServerFn({ method: "GET" })
  .inputValidator(tokenSchema)
  .handler(async ({ data }) => {
    const { data: row, error } = await supabaseAdmin
      .from("sales_diagnoses")
      .select("*, sales_prospects(company_name, contact_name, email, monthly_revenue_cents, is_paid)")
      .eq("public_token", data.token)
      .single();

    if (error) throw new Error("Diagnóstico não encontrado.");

    const prospect = row.sales_prospects as {
      company_name: string;
      contact_name: string;
      monthly_revenue_cents: number;
    };

    let metaDiagnostic = null;
    if (row.is_paid) {
      metaDiagnostic = await getCampaignDiagnostics(row.prospect_id);
    }

    return {
      companyName: prospect.company_name,
      contactName: prospect.contact_name,
      email: (prospect as { email?: string }).email,
      overallScore: row.overall_score,
      dimensions: row.dimensions,
      gaps: row.gaps,
      potentialGrowthPct: row.potential_growth_pct,
      narrative: row.narrative,
      isPaid: row.is_paid,
      metaDiagnostic,
    };
  });

// ─── Tripwire checkout R$37 ──────────────────────────────────

const tripwireSchema = z.object({
  token: z.string().min(8),
  email: z.string().email(),
});

export const startTripwireCheckout = createServerFn({ method: "POST" })
  .inputValidator(tripwireSchema)
  .handler(async ({ data }) => {
    const { data: diagnosis, error } = await supabaseAdmin
      .from("sales_diagnoses")
      .select("id, prospect_id, is_paid")
      .eq("public_token", data.token)
      .single();

    if (error) throw new Error("Diagnóstico não encontrado.");
    if (diagnosis.is_paid) return { alreadyPaid: true as const };

    const idempotencyKey = `tripwire:${diagnosis.id}`;
    const { appUrl } = getServerConfig();

    const preference = await createPreference({
      title: "Diagnóstico completo Meta Ads — Orbia",
      amountCents: DIAGNOSTIC_TRIPWIRE_CENTS,
      payerEmail: data.email,
      externalReference: idempotencyKey,
      backUrl: `${appUrl}/diagnostico/resultado/${data.token}?paid=1`,
    });

    await supabaseAdmin.from("sales_diagnosis_purchases").upsert(
      {
        diagnosis_id: diagnosis.id,
        prospect_id: diagnosis.prospect_id,
        idempotency_key: idempotencyKey,
        amount_cents: DIAGNOSTIC_TRIPWIRE_CENTS,
        status: "pending",
        provider_ref: preference.id,
      },
      { onConflict: "idempotency_key" },
    );

    return { initPoint: preference.init_point, alreadyPaid: false as const };
  });

export const confirmTripwirePayment = createServerFn({ method: "POST" })
  .inputValidator(tokenSchema)
  .handler(async ({ data }) => {
    const { data: diagnosis } = await supabaseAdmin
      .from("sales_diagnoses")
      .select("id, prospect_id")
      .eq("public_token", data.token)
      .single();

    if (!diagnosis) throw new Error("Diagnóstico não encontrado.");

    await supabaseAdmin
      .from("sales_diagnoses")
      .update({ is_paid: true })
      .eq("id", diagnosis.id);

    await supabaseAdmin
      .from("sales_diagnosis_purchases")
      .update({ status: "paid" })
      .eq("diagnosis_id", diagnosis.id);

    const metaDiag = await getCampaignDiagnostics(diagnosis.prospect_id);
    return { metaDiagnostic: metaDiag };
  });

// ─── Download diagnostic PDF ─────────────────────────────────

export const getDiagnosticPdf = createServerFn({ method: "GET" })
  .inputValidator(tokenSchema)
  .handler(async ({ data }) => {
    const { data: row } = await supabaseAdmin
      .from("sales_diagnoses")
      .select("*, sales_prospects(company_name, contact_name, monthly_revenue_cents)")
      .eq("public_token", data.token)
      .single();

    if (!row) throw new Error("Diagnóstico não encontrado.");
    const p = row.sales_prospects as {
      company_name: string;
      contact_name: string;
      monthly_revenue_cents: number;
    };

    const pdf = await buildDiagnosticPdf(
      p.company_name,
      p.contact_name,
      Number(p.monthly_revenue_cents),
      {
        overallScore: row.overall_score,
        dimensions: row.dimensions as never[],
        gaps: row.gaps as never[],
        potentialGrowthPct: Number(row.potential_growth_pct),
        narrative: row.narrative ?? "",
      },
    );

    return { base64: pdfToBase64(pdf) };
  });

// ─── Track prospect page event (public) ──────────────────────

const trackEventSchema = z.object({
  prospectId: z.string().uuid().optional(),
  token: z.string().optional(),
  eventType: z.enum([
    "email_opened",
    "diagnosis_clicked",
    "pricing_visited",
    "proposal_opened",
    "proposal_section_viewed",
    "contract_viewed",
  ]),
  metadata: z.record(z.unknown()).optional(),
});

export const trackProspectEvent = createServerFn({ method: "POST" })
  .inputValidator(trackEventSchema)
  .handler(async ({ data }) => {
    let prospectId = data.prospectId;
    if (!prospectId && data.token) {
      const { data: proposal } = await supabaseAdmin
        .from("sales_proposals")
        .select("prospect_id")
        .eq("public_token", data.token)
        .maybeSingle();
      prospectId = proposal?.prospect_id;
    }
    if (!prospectId) return { ok: false };

    await supabaseAdmin.from("sales_prospect_events").insert({
      prospect_id: prospectId,
      event_type: data.eventType,
      metadata: (data.metadata ?? {}) as Json,
    });

    if (data.eventType === "proposal_opened") {
      await emitDomainEvent("proposal.opened", { prospectId });
    }

    return { ok: true };
  });

// ─── Public proposal ─────────────────────────────────────────

export const getPublicProposal = createServerFn({ method: "GET" })
  .inputValidator(tokenSchema)
  .handler(async ({ data }) => {
    const { data: proposal, error } = await supabaseAdmin
      .from("sales_proposals")
      .select("*, sales_prospects(company_name, contact_name, segment)")
      .eq("public_token", data.token)
      .single();

    if (error) throw new Error("Proposta não encontrada.");

    if (new Date(proposal.valid_until) < new Date()) {
      await supabaseAdmin
        .from("sales_proposals")
        .update({ status: "expired" })
        .eq("id", proposal.id);
      throw new Error("Proposta expirada.");
    }

    if (proposal.status === "sent") {
      await supabaseAdmin
        .from("sales_proposals")
        .update({ status: "viewed" })
        .eq("id", proposal.id);
    }

    const prospect = proposal.sales_prospects as {
      company_name: string;
      contact_name: string;
      segment: string;
    };

    return {
      companyName: prospect.company_name,
      contactName: prospect.contact_name,
      recommendedPlan: proposal.recommended_plan,
      roiParams: proposal.roi_params,
      content: proposal.content,
      validUntil: proposal.valid_until,
      version: proposal.version,
      status: proposal.status,
    };
  });

const trackSectionSchema = z.object({
  token: z.string(),
  sectionKey: z.string(),
  durationMs: z.number().int().min(0),
  userAgent: z.string().optional(),
});

export const trackProposalSection = createServerFn({ method: "POST" })
  .inputValidator(trackSectionSchema)
  .handler(async ({ data }) => {
    const { data: proposal } = await supabaseAdmin
      .from("sales_proposals")
      .select("id, prospect_id")
      .eq("public_token", data.token)
      .single();

    if (!proposal) return { ok: false };

    await supabaseAdmin.from("sales_proposal_views").insert({
      proposal_id: proposal.id,
      section_key: data.sectionKey,
      duration_ms: data.durationMs,
      user_agent: data.userAgent,
    });

    await supabaseAdmin.from("sales_prospect_events").insert({
      prospect_id: proposal.prospect_id,
      event_type: "proposal_section_viewed",
      metadata: { section: data.sectionKey, duration_ms: data.durationMs },
    });

    return { ok: true };
  });

// ─── Public contract ─────────────────────────────────────────

export const getPublicContract = createServerFn({ method: "GET" })
  .inputValidator(tokenSchema)
  .handler(async ({ data }) => {
    const { data: contract, error } = await supabaseAdmin
      .from("sales_contracts")
      .select("*, sales_prospects(company_name, contact_name, email)")
      .eq("public_token", data.token)
      .single();

    if (error) throw new Error("Contrato não encontrado.");

    const prospect = contract.sales_prospects as {
      company_name: string;
      contact_name: string;
      email: string;
    };

    return {
      companyName: prospect.company_name,
      contactName: prospect.contact_name,
      email: prospect.email,
      plan: contract.plan,
      monthlyCents: contract.monthly_cents,
      clauses: contract.clauses,
      status: contract.status,
      signedAt: contract.signed_at,
      html: (contract.clauses as { html?: string })?.html ?? "",
    };
  });

const signContractSchema = z.object({
  token: z.string(),
  signerName: z.string().min(2),
  signerEmail: z.string().email(),
  signerIp: z.string().optional(),
});

export const signContractPublic = createServerFn({ method: "POST" })
  .inputValidator(signContractSchema)
  .handler(async ({ data }) => {
    const { data: contract, error } = await supabaseAdmin
      .from("sales_contracts")
      .select("*, sales_prospects(id, company_name, segment, assigned_staff_id)")
      .eq("public_token", data.token)
      .single();

    if (error) throw new Error("Contrato não encontrado.");
    if (contract.status === "signed") return { alreadySigned: true };

    await supabaseAdmin
      .from("sales_contracts")
      .update({
        status: "signed",
        signed_at: new Date().toISOString(),
        signer_name: data.signerName,
        signer_email: data.signerEmail,
        signer_ip: data.signerIp,
      })
      .eq("id", contract.id);

    const prospect = contract.sales_prospects as {
      id: string;
      company_name: string;
      segment: string;
      assigned_staff_id: string | null;
    };

    const staffId =
      prospect.assigned_staff_id ??
      (
        await supabaseAdmin
          .from("profiles")
          .select("id")
          .in("role", ["orbia_admin", "orbia_staff"])
          .limit(1)
          .maybeSingle()
      )?.id;

    if (!staffId) throw new Error("Nenhum staff disponível para provisionar cliente.");

    const { convertProspectToClient } = await import("./conversion.server");
    const { clientId } = await convertProspectToClient(
      prospect.id,
      staffId,
      contract.plan as "launch" | "growth" | "scale",
    );

    const signedStageId = await getStageIdByKey("contract_signed");
    await supabaseAdmin
      .from("sales_prospects")
      .update({ stage_id: signedStageId })
      .eq("id", prospect.id);

    return { clientId, alreadySigned: false };
  });

// ─── Partner registration (public) ───────────────────────────

const partnerRegisterSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
});

export const registerPartnerPublic = createServerFn({ method: "POST" })
  .inputValidator(partnerRegisterSchema)
  .handler(async ({ data }) => {
    const { registerPartner } = await import("./partners/partners.server");
    return registerPartner(data);
  });
