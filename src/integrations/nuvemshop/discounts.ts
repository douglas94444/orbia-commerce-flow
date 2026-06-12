import { decryptToken } from "@/lib/crypto.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { nuvemshopFetch } from "./client";

interface NuvemshopCoupon {
  id: number;
  code: string;
}

export async function createNuvemshopDiscount(input: {
  clientId: string;
  code: string;
  discountPct: number;
  expiresAt: string;
}): Promise<{ externalId: string } | null> {
  const { data: conn } = await supabaseAdmin
    .from("oauth_connections")
    .select("external_account, access_token")
    .eq("client_id", input.clientId)
    .eq("provider", "nuvemshop")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (!conn?.access_token || !conn.external_account) return null;

  const storeId = conn.external_account;
  const accessToken = decryptToken(conn.access_token);
  const expiresDate = input.expiresAt.slice(0, 10);

  const coupon = await nuvemshopFetch<NuvemshopCoupon>(storeId, accessToken, "/coupons", {
    method: "POST",
    body: JSON.stringify({
      code: input.code,
      type: "percentage",
      value: String(input.discountPct),
      valid: true,
      max_uses: 1,
      end_date: expiresDate,
    }),
  });

  return { externalId: String(coupon.id) };
}
