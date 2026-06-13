import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  PLAN_LABELS,
  PLAN_PRICES_CENTS,
  recommendPlan,
  type PlanTier,
} from "@/shared/constants/plans";
import type { DiagnosisResult } from "../diagnosis/diagnosis-engine.server";

export interface ProposalContent {
  headline: string;
  diagnosisSummary: string;
  recommendedPlan: PlanTier;
  planJustification: string;
  roiParams: {
    currentRevenueCents: number;
    projectedGrowthPct: number;
    monthlyInvestmentCents: number;
    paybackMonths: number;
  };
  successCases: Array<{ name: string; segment: string; result: string }>;
  faq: Array<{ q: string; a: string }>;
}

export async function buildProposalContent(
  prospect: {
    company_name: string;
    segment: string;
    monthly_revenue_cents: number;
    main_pain: string | null;
  },
  diagnosis: DiagnosisResult | null,
): Promise<ProposalContent> {
  const plan = recommendPlan(Number(prospect.monthly_revenue_cents));
  const growthPct = diagnosis?.potentialGrowthPct ?? 15;
  const projectedRevenue = Math.round(
    Number(prospect.monthly_revenue_cents) * (1 + growthPct / 100),
  );
  const monthlyInvestment = PLAN_PRICES_CENTS[plan];
  const incremental = projectedRevenue - Number(prospect.monthly_revenue_cents);
  const paybackMonths =
    incremental > 0 ? Math.max(1, Math.ceil(monthlyInvestment / incremental)) : 6;

  const { data: cases } = await supabaseAdmin
    .from("clients")
    .select("name, segment, gmv_30d, roas_avg, health_score")
    .eq("status", "active")
    .eq("segment", prospect.segment)
    .order("health_score", { ascending: false })
    .limit(3);

  const successCases = (cases ?? []).map((c) => ({
    name: c.name,
    segment: c.segment ?? prospect.segment,
    result: `Health ${c.health_score}/100 · ROAS ${Number(c.roas_avg).toFixed(1)}x`,
  }));

  if (successCases.length === 0) {
    successCases.push(
      { name: "Loja referência Moda", segment: prospect.segment, result: "ROAS 6.2x em 90 dias" },
      { name: "Operação omnichannel", segment: prospect.segment, result: "GMV +28% pós-onboarding" },
    );
  }

  return {
    headline: `Proposta personalizada para ${prospect.company_name}`,
    diagnosisSummary:
      diagnosis?.narrative ??
      `Com base no perfil informado, recomendamos o plano ${PLAN_LABELS[plan]} para resolver ${prospect.main_pain ?? "gargalos operacionais"}.`,
    recommendedPlan: plan,
    planJustification: `O plano ${PLAN_LABELS[plan]} equilibra investimento (R$ ${(monthlyInvestment / 100).toLocaleString("pt-BR")}/mês) com o potencial de crescimento de ${growthPct}% identificado no diagnóstico.`,
    roiParams: {
      currentRevenueCents: Number(prospect.monthly_revenue_cents),
      projectedGrowthPct: growthPct,
      monthlyInvestmentCents: monthlyInvestment,
      paybackMonths,
    },
    successCases,
    faq: [
      {
        q: "Quanto tempo até ver resultados?",
        a: "A maioria dos clientes observa melhorias em tráfego e operação nas primeiras 4–6 semanas.",
      },
      {
        q: "Preciso trocar de plataforma?",
        a: "Não. Orbia integra Shopify, Nuvemshop e marketplaces sem migração.",
      },
      {
        q: "Como funciona o cancelamento?",
        a: "Aviso prévio de 30 dias conforme contrato. Sem multa após período mínimo.",
      },
    ],
  };
}
