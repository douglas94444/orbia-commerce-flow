import { supabaseAdmin } from "@/integrations/supabase/client.server";

const CART_DISCOUNTS = [5, 8, 12] as const;
const REACTIVATION_DISCOUNTS: Record<string, number> = {
  reativacao_30d: 5,
  reativacao_60d: 10,
  reativacao_90d: 15,
};

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
  } else if (trigger.startsWith("reativacao_")) {
    discountPct = REACTIVATION_DISCOUNTS[trigger] ?? 5;
    prefix = "REAT";
  } else if (trigger === "aniversario") {
    discountPct = 15;
    prefix = "BDAY";
  } else {
    return context;
  }

  const code = generateCode(prefix);
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + (trigger === "aniversario" ? 48 : 72));

  await supabaseAdmin.from("automation_coupons").insert({
    client_id: clientId,
    customer_id: customerId,
    code,
    discount_pct: discountPct,
    expires_at: expiresAt.toISOString(),
    source: trigger,
  });

  return {
    ...context,
    coupon_code: code,
    discount_pct: discountPct,
    coupon_expires_at: expiresAt.toISOString(),
  };
}
