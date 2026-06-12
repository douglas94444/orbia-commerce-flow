import { getServerConfig } from "@/lib/config.server";
import { logIntegration, startTimer } from "@/shared/lib/logger";

const BASE = "https://api.pagar.me/core/v5";

function authHeader(apiKey: string): string {
  return `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`;
}

/** Registra desconto aplicado na charge Pagar.me (metadata) quando cupom Orbia foi usado. */
export async function applyPagarMeCouponMetadata(input: {
  chargeId: string;
  couponCode: string;
  discountPct: number;
  clientId?: string;
}): Promise<boolean> {
  const { pagarMe } = getServerConfig();
  if (!pagarMe.apiKey) return false;

  const end = startTimer();
  const res = await fetch(`${BASE}/charges/${input.chargeId}`, {
    method: "PATCH",
    headers: {
      Authorization: authHeader(pagarMe.apiKey),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      metadata: {
        orbia_coupon_code: input.couponCode,
        orbia_discount_pct: String(input.discountPct),
      },
    }),
  });

  await logIntegration({
    provider: "pagar_me",
    operation: "apply_coupon_metadata",
    status: res.ok ? "success" : "error",
    response_code: res.status,
    duration_ms: end(),
    client_id: input.clientId,
  });

  return res.ok;
}
