import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type ProspectTemperature = "cold" | "warm" | "hot";
export type ProspectUrgency = "now" | "30d" | "90d" | "exploring" | null;

export interface LeadScoringInput {
  monthlyRevenueCents: number;
  adSpendCents: number;
  isDecisionMaker: boolean;
  mainPain: string | null;
  urgency: ProspectUrgency;
  platform: string | null;
}

export interface LeadScoringResult {
  bantBudget: number;
  bantAuthority: number;
  bantNeed: number;
  bantTimeline: number;
  qualificationScore: number;
  temperature: ProspectTemperature;
}

const PAIN_KEYWORDS = [
  "tráfego",
  "roas",
  "anúncio",
  "logística",
  "estoque",
  "nf-e",
  "fiscal",
  "retenção",
  "whatsapp",
  "carrinho",
  "marketplace",
];

export function computeLeadScore(input: LeadScoringInput): LeadScoringResult {
  let bantBudget = 0;
  if (input.adSpendCents >= 500_000) bantBudget += 15;
  else if (input.adSpendCents >= 200_000) bantBudget += 10;
  else if (input.adSpendCents >= 50_000) bantBudget += 5;
  if (input.monthlyRevenueCents >= 5_000_000) bantBudget += 10;
  else if (input.monthlyRevenueCents >= 2_000_000) bantBudget += 7;
  else if (input.monthlyRevenueCents >= 500_000) bantBudget += 4;
  bantBudget = Math.min(25, bantBudget);

  const bantAuthority = input.isDecisionMaker ? 25 : 10;

  let bantNeed = 0;
  const pain = (input.mainPain ?? "").toLowerCase();
  if (pain.length > 10) bantNeed += 10;
  if (PAIN_KEYWORDS.some((k) => pain.includes(k))) bantNeed += 15;
  bantNeed = Math.min(25, bantNeed);

  let bantTimeline = 5;
  if (input.urgency === "now") bantTimeline = 25;
  else if (input.urgency === "30d") bantTimeline = 18;
  else if (input.urgency === "90d") bantTimeline = 10;

  const qualificationScore = bantBudget + bantAuthority + bantNeed + bantTimeline;

  let temperature: ProspectTemperature = "cold";
  if (
    input.monthlyRevenueCents >= 5_000_000 &&
    input.adSpendCents >= 500_000
  ) {
    temperature = "hot";
  } else if (qualificationScore >= 60) {
    temperature = "warm";
  }

  return {
    bantBudget,
    bantAuthority,
    bantNeed,
    bantTimeline,
    qualificationScore,
    temperature,
  };
}

export async function getCapturedStageId(): Promise<string> {
  const { data } = await supabaseAdmin
    .from("sales_pipeline_stages")
    .select("id")
    .eq("stage_key", "captured")
    .single();
  if (!data?.id) throw new Error("Estágio captured não encontrado.");
  return data.id;
}

export async function getStageIdByKey(stageKey: string): Promise<string> {
  const { data } = await supabaseAdmin
    .from("sales_pipeline_stages")
    .select("id")
    .eq("stage_key", stageKey)
    .single();
  if (!data?.id) throw new Error(`Estágio ${stageKey} não encontrado.`);
  return data.id;
}
