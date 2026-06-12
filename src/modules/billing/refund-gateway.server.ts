import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getServerConfig } from "@/lib/config.server";
import { logIntegration } from "@/shared/lib/logger";

interface RefundResult {
  provider: string;
  providerTxId: string | null;
  usedGateway: boolean;
}

async function refundPagarMe(chargeId: string, amountCents: number): Promise<RefundResult> {
  const { pagarMe } = getServerConfig();
  if (!pagarMe.apiKey) {
    return { provider: "orbia", providerTxId: null, usedGateway: false };
  }

  const encoded = Buffer.from(`${pagarMe.apiKey}:`).toString("base64");
  const res = await fetch(`https://api.pagar.me/core/v5/charges/${chargeId}/refunds`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${encoded}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ amount: amountCents }),
  });

  const body = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(String(body.message ?? `Pagar.me refund failed: ${res.status}`));
  }

  return {
    provider: "pagar_me",
    providerTxId: String(body.id ?? chargeId),
    usedGateway: true,
  };
}

async function refundMercadoPago(paymentId: string, amountCents: number): Promise<RefundResult> {
  const { mercadoPago } = getServerConfig();
  if (!mercadoPago.accessToken) {
    return { provider: "orbia", providerTxId: null, usedGateway: false };
  }

  const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}/refunds`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${mercadoPago.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ amount: amountCents / 100 }),
  });

  const body = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(String(body.message ?? `MP refund failed: ${res.status}`));
  }

  return {
    provider: "mercado_pago",
    providerTxId: String(body.id ?? paymentId),
    usedGateway: true,
  };
}

export async function refundOrderPayment(
  clientId: string,
  orderId: string,
  amountCents: number,
): Promise<RefundResult> {
  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("metadata")
    .eq("id", orderId)
    .eq("client_id", clientId)
    .maybeSingle();

  if (!order) throw new Error("Pedido não encontrado");

  const meta = (order.metadata ?? {}) as Record<string, unknown>;
  const paymentProvider = String(meta.payment_provider ?? "");
  const paymentId = String(
    meta.payment_id ?? meta.mercado_pago_payment_id ?? meta.pagar_me_charge_id ?? "",
  );

  if (!paymentId) {
    return { provider: "orbia", providerTxId: null, usedGateway: false };
  }

  try {
    if (paymentProvider === "pagar_me" || paymentId.startsWith("ch_")) {
      const result = await refundPagarMe(paymentId, amountCents);
      await logIntegration({
        client_id: clientId,
        provider: "pagar_me",
        operation: "refund",
        status: result.usedGateway ? "success" : "error",
        request_data: { orderId, amountCents, paymentId },
      });
      return result;
    }

    if (paymentProvider === "mercado_pago" || paymentId.match(/^\d+$/)) {
      const result = await refundMercadoPago(paymentId, amountCents);
      await logIntegration({
        client_id: clientId,
        provider: "mercado_pago",
        operation: "refund",
        status: "success",
        request_data: { orderId, amountCents, paymentId },
      });
      return result;
    }

    return { provider: "orbia", providerTxId: null, usedGateway: false };
  } catch (err) {
    await logIntegration({
      client_id: clientId,
      provider: paymentProvider || "payment",
      operation: "refund",
      status: "error",
      error_message: (err as Error).message,
      request_data: { orderId, amountCents },
    });
    throw err;
  }
}
