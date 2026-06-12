import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { CatalogChannel } from "./sync-catalog.server";

export type PricingRuleType = "margin_pct" | "markup_pct" | "fixed_cents";

export interface ChannelPricingRule {
  ruleType: PricingRuleType;
  value: number;
  minPriceCents: number | null;
}

export async function getChannelPricingRules(
  clientId: string,
  channel: CatalogChannel,
): Promise<ChannelPricingRule[]> {
  const { data } = await supabaseAdmin
    .from("channel_pricing_rules")
    .select("rule_type, value, min_price_cents")
    .eq("client_id", clientId)
    .eq("channel", channel)
    .eq("is_active", true);

  return (data ?? []).map((row) => ({
    ruleType: row.rule_type as PricingRuleType,
    value: Number(row.value),
    minPriceCents: row.min_price_cents != null ? Number(row.min_price_cents) : null,
  }));
}

export function applyPricingRules(
  basePriceCents: number,
  rules: ChannelPricingRule[],
): number {
  let price = basePriceCents;

  for (const rule of rules) {
    switch (rule.ruleType) {
      case "margin_pct":
        price = Math.round(basePriceCents / (1 - rule.value / 100));
        break;
      case "markup_pct":
        price = Math.round(basePriceCents * (1 + rule.value / 100));
        break;
      case "fixed_cents":
        price = Math.round(basePriceCents + rule.value);
        break;
    }
    if (rule.minPriceCents != null) {
      price = Math.max(price, rule.minPriceCents);
    }
  }

  return Math.max(0, price);
}

export async function computeChannelPrice(
  clientId: string,
  channel: CatalogChannel,
  basePriceCents: number,
): Promise<number> {
  const rules = await getChannelPricingRules(clientId, channel);
  if (!rules.length) return basePriceCents;
  return applyPricingRules(basePriceCents, rules);
}
