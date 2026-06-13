import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface DiagnosisDimension {
  key: string;
  label: string;
  score: number;
  benchmark: number;
  impact: string;
  solution: string;
  module: string;
}

export interface DiagnosisGap {
  title: string;
  description: string;
  severity: "critical" | "warning" | "info";
  solution: string;
  module: string;
}

export interface DiagnosisInput {
  platform: string | null;
  monthlyRevenueCents: number;
  adSpendCents: number;
  mainPain: string | null;
  segment: string;
  fulfillmentType?: "own" | "third_party" | null;
  hasEmailAutomation?: boolean;
  hasWhatsappAutomation?: boolean;
}

export interface DiagnosisResult {
  overallScore: number;
  dimensions: DiagnosisDimension[];
  gaps: DiagnosisGap[];
  potentialGrowthPct: number;
  narrative: string;
}

async function getPortfolioBenchmarks(): Promise<{
  avgRoas: number;
  p75Roas: number;
  avgSla: number;
  avgHealth: number;
  avgGmvCents: number;
}> {
  const { data: latest } = await supabaseAdmin
    .from("benchmark_snapshots")
    .select("value, portfolio_p75, metric_key")
    .is("client_id", null)
    .order("created_at", { ascending: false })
    .limit(10);

  const { data: clients } = await supabaseAdmin
    .from("clients")
    .select("gmv_30d, health_score, roas_avg")
    .eq("status", "active");

  const gmvList = (clients ?? []).map((c) => Number(c.gmv_30d));
  const avgGmv = gmvList.length ? gmvList.reduce((a, b) => a + b, 0) / gmvList.length : 500_000_00;
  const roasList = (clients ?? []).map((c) => Number(c.roas_avg));
  const avgRoas = roasList.length ? roasList.reduce((a, b) => a + b, 0) / roasList.length : 4.5;
  const sortedRoas = [...roasList].sort((a, b) => a - b);
  const p75Roas = sortedRoas[Math.floor(sortedRoas.length * 0.75)] ?? 6;

  const roasSnap = latest?.find((s) => s.metric_key === "roas");
  const avgHealth =
    (clients ?? []).reduce((s, c) => s + (c.health_score ?? 0), 0) / Math.max(1, clients?.length ?? 1);

  return {
    avgRoas: roasSnap?.value ?? avgRoas,
    p75Roas: roasSnap?.portfolio_p75 ?? p75Roas,
    avgSla: 85,
    avgHealth,
    avgGmvCents: avgGmv,
  };
}

function scoreFromRatio(actual: number, benchmark: number, invert = false): number {
  if (benchmark <= 0) return 50;
  const ratio = actual / benchmark;
  const effective = invert ? 1 / Math.max(ratio, 0.01) : ratio;
  return Math.min(100, Math.max(0, Math.round(effective * 70)));
}

export async function runDiagnosisEngine(input: DiagnosisInput): Promise<DiagnosisResult> {
  const bench = await getPortfolioBenchmarks();

  const adRoasEstimate =
    input.adSpendCents > 0
      ? (input.monthlyRevenueCents * 0.4) / input.adSpendCents
      : 0;

  const ecommerceScore = scoreFromRatio(input.monthlyRevenueCents, bench.avgGmvCents);
  const trafficScore =
    input.adSpendCents > 0 ? scoreFromRatio(adRoasEstimate, bench.p75Roas) : 40;
  const logisticsScore =
    input.fulfillmentType === "third_party" ? 65 : input.fulfillmentType === "own" ? 55 : 45;
  const retentionScore =
    (input.hasEmailAutomation ? 15 : 0) +
    (input.hasWhatsappAutomation ? 15 : 0) +
    (input.mainPain?.toLowerCase().includes("retenção") ? 20 : 30);

  const dimensions: DiagnosisDimension[] = [
    {
      key: "ecommerce",
      label: "Estrutura e-commerce",
      score: ecommerceScore,
      benchmark: 75,
      impact: ecommerceScore < 60 ? "Faturamento abaixo da média da carteira Orbia" : "Operação em patamar competitivo",
      solution: "Centralizar canais e métricas no painel omnichannel",
      module: "logistics",
    },
    {
      key: "traffic",
      label: "Tráfego pago",
      score: trafficScore,
      benchmark: Math.round(bench.p75Roas * 10),
      impact:
        trafficScore < 50
          ? `ROAS estimado abaixo do P75 (${bench.p75Roas.toFixed(1)}x) — dinheiro sendo desperdiçado`
          : "Investimento em mídia com retorno saudável",
      solution: "Diagnóstico de campanhas Meta/Google com otimização contínua",
      module: "traffic",
    },
    {
      key: "logistics",
      label: "Logística",
      score: logisticsScore,
      benchmark: bench.avgSla,
      impact: logisticsScore < 60 ? "SLA e fulfillment abaixo do benchmark da carteira" : "Logística alinhada com melhores lojistas",
      solution: "Fulfillment gerenciado com SLA garantido",
      module: "logistics",
    },
    {
      key: "retention",
      label: "Retenção & LTV",
      score: Math.min(100, retentionScore),
      benchmark: 70,
      impact: retentionScore < 50 ? "Ausência de automações reduz recompra e LTV" : "Base de retenção em construção",
      solution: "Automações WhatsApp e email pós-venda",
      module: "retention",
    },
  ];

  const gaps: DiagnosisGap[] = [];
  for (const d of dimensions) {
    if (d.score < 60) {
      gaps.push({
        title: d.label,
        description: d.impact,
        severity: d.score < 40 ? "critical" : "warning",
        solution: d.solution,
        module: d.module,
      });
    }
  }

  if (input.adSpendCents >= 500_000 && trafficScore < 55) {
    gaps.push({
      title: "Desperdício em mídia",
      description: `Com R$ ${(input.adSpendCents / 100).toLocaleString("pt-BR")}/mês em ads e ROAS abaixo do ideal, cada mês sem otimização custa margem real.`,
      severity: "critical",
      solution: "Gestão de tráfego com diagnóstico semanal de campanhas",
      module: "traffic",
    });
  }

  const overallScore = Math.round(
    dimensions.reduce((s, d) => s + d.score, 0) / dimensions.length,
  );

  const avgDimScore = overallScore;
  const potentialGrowthPct = Math.min(
    45,
    Math.max(5, Math.round((100 - avgDimScore) * 0.35)),
  );

  const narrative = `Sua operação de ${input.segment} tem score geral de ${overallScore}/100. ${
    gaps.length > 0
      ? `Identificamos ${gaps.length} área(s) crítica(s) que, corrigidas, podem elevar seu faturamento em até ${potentialGrowthPct}% nos próximos 90 dias — com base nos benchmarks da carteira Orbia.`
      : "Sua operação está acima da média; o próximo passo é escalar com gestão profissional."
  }`;

  return { overallScore, dimensions, gaps, potentialGrowthPct, narrative };
}

export async function saveDiagnosis(
  prospectId: string,
  result: DiagnosisResult,
): Promise<{ id: string; publicToken: string }> {
  const { data, error } = await supabaseAdmin
    .from("sales_diagnoses")
    .insert({
      prospect_id: prospectId,
      type: "full",
      overall_score: result.overallScore,
      dimensions: result.dimensions,
      gaps: result.gaps,
      potential_growth_pct: result.potentialGrowthPct,
      narrative: result.narrative,
    })
    .select("id, public_token")
    .single();

  if (error) throw new Error(error.message);
  return { id: data.id, publicToken: data.public_token };
}
