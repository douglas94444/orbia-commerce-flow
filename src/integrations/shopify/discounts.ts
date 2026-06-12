import { decryptToken } from "@/lib/crypto.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { shopifyFetch } from "./client";

export async function createShopifyDiscount(input: {
  clientId: string;
  code: string;
  discountPct: number;
  expiresAt: string;
}): Promise<{ externalId: string } | null> {
  const { data: conn } = await supabaseAdmin
    .from("oauth_connections")
    .select("external_account, access_token")
    .eq("client_id", input.clientId)
    .eq("provider", "shopify")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (!conn?.access_token || !conn.external_account) return null;

  const shop = conn.external_account;
  const accessToken = decryptToken(conn.access_token);
  const endsAt = input.expiresAt;

  const priceRule = await shopifyFetch<{ price_rule: { id: number } }>(
    shop,
    accessToken,
    "/price_rules.json",
    {
      method: "POST",
      body: JSON.stringify({
        price_rule: {
          title: `Orbia ${input.code}`,
          target_type: "line_item",
          target_selection: "all",
          allocation_method: "across",
          value_type: "percentage",
          value: `-${input.discountPct}`,
          customer_selection: "all",
          starts_at: new Date().toISOString(),
          ends_at: endsAt,
          usage_limit: 1,
        },
      }),
    },
  );

  const discount = await shopifyFetch<{ discount_code: { id: number } }>(
    shop,
    accessToken,
    `/price_rules/${priceRule.price_rule.id}/discount_codes.json`,
    {
      method: "POST",
      body: JSON.stringify({ discount_code: { code: input.code } }),
    },
  );

  return { externalId: String(discount.discount_code.id) };
}
