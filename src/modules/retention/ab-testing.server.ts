import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function pickAbVariant(stepId: string): Promise<string | null> {
  const { data: experiment } = await supabaseAdmin
    .from("ab_experiments")
    .select("id, variant_a_key, variant_b_key, traffic_split, sends_a, sends_b, conversions_a, conversions_b, winner")
    .eq("step_id", stepId)
    .eq("is_active", true)
    .maybeSingle();

  if (!experiment) return null;

  if (experiment.winner === "a") return experiment.variant_a_key;
  if (experiment.winner === "b") return experiment.variant_b_key;

  const totalSends = experiment.sends_a + experiment.sends_b;
  const rateA = experiment.sends_a > 0 ? experiment.conversions_a / experiment.sends_a : 0;
  const rateB = experiment.sends_b > 0 ? experiment.conversions_b / experiment.sends_b : 0;

  let pickA: boolean;
  if (totalSends < 100) {
    pickA = Math.random() * 100 < experiment.traffic_split;
  } else {
    pickA = rateA >= rateB;
  }

  const variant = pickA ? experiment.variant_a_key : experiment.variant_b_key;
  const field = pickA ? "sends_a" : "sends_b";

  await supabaseAdmin
    .from("ab_experiments")
    .update({ [field]: (experiment as Record<string, number>)[field] + 1 })
    .eq("id", experiment.id);

  return variant;
}

export async function recordAbConversion(stepId: string, variantKey: string): Promise<void> {
  const { data: experiment } = await supabaseAdmin
    .from("ab_experiments")
    .select("id, variant_a_key, variant_b_key, conversions_a, conversions_b")
    .eq("step_id", stepId)
    .eq("is_active", true)
    .maybeSingle();

  if (!experiment) return;

  const field =
    variantKey === experiment.variant_a_key ? "conversions_a" : "conversions_b";

  await supabaseAdmin
    .from("ab_experiments")
    .update({ [field]: (experiment as Record<string, number>)[field] + 1 })
    .eq("id", experiment.id);
}
