import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface CampaignDiagnosticDimension {
  key: string;
  label: string;
  score: number;
  finding: string;
  recommendation: string;
}

export interface CampaignDiagnosticResult {
  overallScore: number;
  dimensions: CampaignDiagnosticDimension[];
  wastedSpendCents: number;
  narrative: string;
}

/** Diagnóstico Meta Ads para prospect com OAuth temporário ou dados importados. */
export async function getCampaignDiagnostics(
  prospectId: string,
): Promise<CampaignDiagnosticResult> {
  const { data: prospect } = await supabaseAdmin
    .from("sales_prospects")
    .select("metadata, ad_spend_cents, monthly_revenue_cents")
    .eq("id", prospectId)
    .single();

  const meta = (prospect?.metadata as Record<string, unknown>) ?? {};
  const campaigns = (meta.meta_campaigns as Array<Record<string, unknown>>) ?? [];

  if (!campaigns.length) {
    return buildBenchmarkDiagnostic(
      Number(prospect?.ad_spend_cents ?? 0),
      Number(prospect?.monthly_revenue_cents ?? 0),
    );
  }

  const dimensions: CampaignDiagnosticDimension[] = [];
  const avgRoas =
    campaigns.reduce((s, c) => s + Number(c.roas ?? 0), 0) / campaigns.length;
  const avgDivergence =
    campaigns.reduce((s, c) => s + Number(c.revenue_divergence_pct ?? 0), 0) /
    campaigns.length;

  dimensions.push({
    key: "structure",
    label: "Estrutura de campanhas",
    score: campaigns.length >= 3 ? 75 : 45,
    finding:
      campaigns.length < 3
        ? "Poucas campanhas ativas — estrutura simplificada demais"
        : "Estrutura com segmentação adequada",
    recommendation: "Separar prospecting, retargeting e conversão em campanhas distintas",
  });

  dimensions.push({
    key: "creatives",
    label: "Qualidade dos criativos",
    score: avgRoas >= 4 ? 70 : 40,
    finding: avgRoas < 4 ? "ROAS abaixo do mínimo saudável (4x)" : "Criativos com performance aceitável",
    recommendation: "Testar 3–5 variações de criativo por semana com hook diferente",
  });

  dimensions.push({
    key: "pixel",
    label: "Configuração de pixel",
    score: avgDivergence > 20 ? 35 : 80,
    finding:
      avgDivergence > 20
        ? `Divergência de ${avgDivergence.toFixed(0)}% entre pixel e pedidos reais`
        : "Pixel alinhado com pedidos",
    recommendation: "Implementar CAPI (Conversions API) e eventos de compra server-side",
  });

  dimensions.push({
    key: "audiences",
    label: "Estratégia de públicos",
    score: 55,
    finding: "Públicos amplos sem exclusão de compradores recentes",
    recommendation: "Criar lookalike 1–3% e excluir compradores 180 dias",
  });

  dimensions.push({
    key: "retargeting",
    label: "Aproveitamento de retargeting",
    score: 50,
    finding: "Retargeting subutilizado em relação ao investimento total",
    recommendation: "Destinar 20–30% do budget para remarketing de carrinho e visitantes",
  });

  dimensions.push({
    key: "conversions",
    label: "Configuração de conversões",
    score: avgDivergence > 15 ? 40 : 75,
    finding: "Eventos de conversão possivelmente duplicados ou mal priorizados",
    recommendation: "Priorizar evento Purchase como conversão principal",
  });

  const overallScore = Math.round(
    dimensions.reduce((s, d) => s + d.score, 0) / dimensions.length,
  );

  const adSpend = Number(prospect?.ad_spend_cents ?? 0);
  const wastedSpendCents = avgRoas < 4 ? Math.round(adSpend * 0.35) : Math.round(adSpend * 0.1);

  return {
    overallScore,
    dimensions,
    wastedSpendCents,
    narrative: `Análise de ${campaigns.length} campanhas Meta Ads: score ${overallScore}/100. ${
      wastedSpendCents > 0
        ? `Estimamos R$ ${(wastedSpendCents / 100).toLocaleString("pt-BR")}/mês em investimento mal aproveitado.`
        : "Sua estrutura de mídia está acima da média."
    }`,
  };
}

function buildBenchmarkDiagnostic(
  adSpendCents: number,
  revenueCents: number,
): CampaignDiagnosticResult {
  const roas = adSpendCents > 0 ? (revenueCents * 0.4) / adSpendCents : 0;
  const score = roas >= 6 ? 80 : roas >= 4 ? 60 : 35;

  return {
    overallScore: score,
    dimensions: [
      {
        key: "traffic",
        label: "Tráfego pago (estimado)",
        score,
        finding: `ROAS estimado ${roas.toFixed(1)}x com base no faturamento informado`,
        recommendation: "Conectar conta Meta Ads para diagnóstico com dados reais das campanhas",
      },
    ],
    wastedSpendCents: roas < 4 ? Math.round(adSpendCents * 0.3) : 0,
    narrative:
      "Relatório baseado em benchmarks da carteira Orbia. Conecte sua conta Meta para análise detalhada das campanhas.",
  };
}

/** Salva token OAuth Meta temporário no metadata do prospect. */
export async function saveProspectMetaOAuth(
  prospectId: string,
  accessToken: string,
  accountId: string,
): Promise<void> {
  const { data: prospect } = await supabaseAdmin
    .from("sales_prospects")
    .select("metadata")
    .eq("id", prospectId)
    .single();

  const meta = (prospect?.metadata as Record<string, unknown>) ?? {};
  await supabaseAdmin
    .from("sales_prospects")
    .update({
      metadata: {
        ...meta,
        meta_oauth: { access_token: accessToken, account_id: accountId, connected_at: new Date().toISOString() },
      },
    })
    .eq("id", prospectId);
}
