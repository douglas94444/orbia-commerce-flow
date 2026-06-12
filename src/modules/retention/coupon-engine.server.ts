import { supabaseAdmin } from "@/integrations/supabase/client.server";

const CART_DISCOUNTS = [5, 8, 12] as const;
const REACTIVATION_DISCOUNTS: Record<string, number> = {
  reativacao_30d: 5,
  reativacao_60d: 10,
  reativacao_90d: 15,
  reativacao_jornada: 5,
};

const REACTIVATION_STEP_DISCOUNTS = [5, 10, 15] as const;

function generateCode(prefix: string): string {
  return `${prefix}${Date.now().toString(36).toUpperCase()}`;
}

export async function ensureEnrollmentCoupon(
  clientId: string,
  customerId: string | null,
  trigger: string,
  stepIndex: number,
  context: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  if (context.coupon_code) return context;

  let discountPct = 0;
  let prefix = "ORBIA";

  if (trigger === "carrinho_abandonado") {
    discountPct = CART_DISCOUNTS[Math.min(stepIndex, CART_DISCOUNTS.length - 1)] ?? 5;
    prefix = "CART";
  } else if (trigger === "reativacao_jornada") {
    discountPct = REACTIVATION_STEP_DISCOUNTS[Math.min(stepIndex, 2)] ?? 5;
    prefix = "REAT";
  } else if (trigger.startsWith("reativacao_")) {
    discountPct = REACTIVATION_DISCOUNTS[trigger] ?? 5;
    prefix = "REAT";
  } else if (trigger === "estoque_favorito") {
    discountPct = 10;
    prefix = "WISH";
  } else if (trigger === "aniversario") {
    discountPct = 15;
    prefix = "BDAY";
  } else {
    return context;
  }

  const code = generateCode(prefix);
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + (trigger === "aniversario" ? 48 : 72));

  const { data: inserted } = await supabaseAdmin
    .from("automation_coupons")
    .insert({
      client_id: clientId,
      customer_id: customerId,
      code,
      discount_pct: discountPct,
      expires_at: expiresAt.toISOString(),
      source: trigger,
    })
    .select("id")
    .single();

  if (inserted?.id) {
    const { syncCouponToCheckoutPlatform } = await import("./checkout-coupon.server");
    await syncCouponToCheckoutPlatform({
      clientId,
      couponId: inserted.id,
      code,
      discountPct,
      expiresAt: expiresAt.toISOString(),
    }).catch((err) => console.error("[coupon] platform sync:", err));
  }

  return {
    ...context,
    coupon_code: code,
    discount_pct: discountPct,
    coupon_expires_at: expiresAt.toISOString(),
  };
}

export interface CouponValidation {
  valid: boolean;
  code: string;
  discountPct: number;
  expiresAt: string;
  customerId: string | null;
}

export async function validateAutomationCoupon(
  clientId: string,
  code: string,
): Promise<CouponValidation | null> {
  const normalized = code.trim().toUpperCase();
  const { data: row } = await supabaseAdmin
    .from("automation_coupons")
    .select("id, discount_pct, expires_at, redeemed_at, customer_id")
    .eq("client_id", clientId)
    .eq("code", normalized)
    .maybeSingle();

  if (!row || row.redeemed_at) return null;
  if (new Date(row.expires_at as string) < new Date()) return null;

  return {
    valid: true,
    code: normalized,
    discountPct: row.discount_pct as number,
    expiresAt: row.expires_at as string,
    customerId: row.customer_id as string | null,
  };
}

export async function redeemAutomationCoupon(
  clientId: string,
  code: string,
  orderId?: string,
): Promise<{ discountPct: number } | null> {
  const coupon = await validateAutomationCoupon(clientId, code);
  if (!coupon) return null;

  await supabaseAdmin
    .from("automation_coupons")
    .update({
      redeemed_at: new Date().toISOString(),
    })
    .eq("client_id", clientId)
    .eq("code", coupon.code);

  if (orderId) {
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("metadata")
      .eq("id", orderId)
      .maybeSingle();
    const meta = (order?.metadata ?? {}) as Record<string, unknown>;
    await supabaseAdmin
      .from("orders")
      .update({
        metadata: {
          ...meta,
          coupon_code: coupon.code,
          coupon_discount_pct: coupon.discountPct,
          coupon_redeemed_at: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);
  }

  return { discountPct: coupon.discountPct };
}

export function applyDiscountCents(amountCents: number, discountPct: number): number {
  return Math.max(0, Math.round(amountCents * (1 - discountPct / 100)));
}
