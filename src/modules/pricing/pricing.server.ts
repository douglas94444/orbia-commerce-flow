import { supabaseAdmin } from "@/integrations/supabase/client.server";

/** Gera recomendação de preço baseada em margem alvo (30%) vs custo estimado. */
export async function generatePricingRecommendations(clientId: string): Promise<number> {
  const { data: products } = await supabaseAdmin
    .from("products")
    .select("sku, price_cents, metadata")
    .eq("client_id", clientId)
    .eq("is_active", true);

  let created = 0;
  const targetMargin = 0.3;

  for (const p of products ?? []) {
    const costCents = Number((p.metadata as { cost_cents?: number })?.cost_cents ?? p.price_cents * 0.55);
    const suggested = Math.round(costCents / (1 - targetMargin));
    if (suggested === p.price_cents) continue;

    const { data: existing } = await supabaseAdmin
      .from("pricing_recommendations")
      .select("id")
      .eq("client_id", clientId)
      .eq("sku", p.sku)
      .eq("status", "draft")
      .maybeSingle();

    if (existing) continue;

    await supabaseAdmin.from("pricing_recommendations").insert({
      client_id: clientId,
      sku: p.sku,
      current_cents: p.price_cents,
      suggested_cents: suggested,
      margin_pct: targetMargin * 100,
      rationale: "Margem alvo 30% sobre custo estimado do catálogo.",
      confidence: 65,
    });
    created++;
  }

  return created;
}
