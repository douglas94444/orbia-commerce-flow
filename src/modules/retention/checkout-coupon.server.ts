import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createNuvemshopDiscount } from "@/integrations/nuvemshop/discounts";
import { createShopifyDiscount } from "@/integrations/shopify/discounts";
import { applyPagarMeCouponMetadata } from "@/integrations/pagar-me/discounts";
import { redeemAutomationCoupon, applyDiscountCents } from "./coupon-engine.server";

function extractCouponCode(raw: Record<string, unknown>, metadata: Record<string, unknown>): string | null {
  const candidates = [
    metadata.coupon_code,
    raw.coupon_code,
    raw.discount_coupon,
    raw.coupon,
  ];

  const nuvemCoupons = raw.coupons as Array<Record<string, unknown>> | undefined;
  if (nuvemCoupons?.[0]?.code) candidates.push(nuvemCoupons[0].code);

  const shopifyCodes = raw.discount_codes as Array<Record<string, unknown>> | undefined;
  if (shopifyCodes?.[0]?.code) candidates.push(shopifyCodes[0].code);

  for (const c of candidates) {
    if (c && String(c).trim()) return String(c).trim().toUpperCase();
  }
  return null;
}

export async function syncCouponToCheckoutPlatform(input: {
  clientId: string;
  couponId: string;
  code: string;
  discountPct: number;
  expiresAt: string;
}): Promise<void> {
  const { data: orderChannel } = await supabaseAdmin
    .from("oauth_connections")
    .select("provider")
    .eq("client_id", input.clientId)
    .eq("is_active", true)
    .in("provider", ["nuvemshop", "shopify"])
    .limit(1)
    .maybeSingle();

  const provider = orderChannel?.provider;
  if (!provider) return;

  let external: { externalId: string } | null = null;
  if (provider === "nuvemshop") {
    external = await createNuvemshopDiscount({
      clientId: input.clientId,
      code: input.code,
      discountPct: input.discountPct,
      expiresAt: input.expiresAt,
    });
  } else if (provider === "shopify") {
    external = await createShopifyDiscount({
      clientId: input.clientId,
      code: input.code,
      discountPct: input.discountPct,
      expiresAt: input.expiresAt,
    });
  }

  if (!external) return;

  await supabaseAdmin
    .from("automation_coupons")
    .update({
      platform: provider,
      external_discount_id: external.externalId,
    })
    .eq("id", input.couponId);
}

export async function processOrderCouponOnPaid(orderId: string): Promise<void> {
  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("id, client_id, value_cents, channel, metadata")
    .eq("id", orderId)
    .maybeSingle();

  if (!order) return;

  const metadata = (order.metadata ?? {}) as Record<string, unknown>;
  const raw = (metadata.raw ?? metadata) as Record<string, unknown>;
  const code = extractCouponCode(raw, metadata);
  if (!code) return;

  const clientId = order.client_id as string;
  const result = await redeemAutomationCoupon(clientId, code, orderId);
  if (!result) return;

  const discountedCents = applyDiscountCents(order.value_cents as number, result.discountPct);
  await supabaseAdmin
    .from("orders")
    .update({
      metadata: {
        ...metadata,
        coupon_code: code,
        coupon_discount_pct: result.discountPct,
        value_after_coupon_cents: discountedCents,
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);

  const chargeId = String(metadata.pagar_me_charge_id ?? raw.charge_id ?? "");
  if (chargeId) {
    await applyPagarMeCouponMetadata({
      chargeId,
      couponCode: code,
      discountPct: result.discountPct,
      clientId,
    }).catch(() => undefined);
  }
}
