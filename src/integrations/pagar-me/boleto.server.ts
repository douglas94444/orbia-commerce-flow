import { getServerConfig } from "@/lib/config.server";
import { logIntegration, startTimer } from "@/shared/lib/logger";

const BASE = "https://api.pagar.me/core/v5";

function authHeader(apiKey: string): string {
  return `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`;
}

export interface BoletoChargeResult {
  boletoUrl: string;
  dueAt: string;
  chargeId: string;
}

export async function createBoletoCharge(input: {
  amountCents: number;
  customerEmail: string;
  customerName: string;
  customerDocument: string;
  orderId: string;
  clientId: string;
  dueDays?: number;
}): Promise<BoletoChargeResult> {
  const { pagarMe } = getServerConfig();
  if (!pagarMe.apiKey) throw new Error("PAGARME_API_KEY não configurada");

  const dueAt = new Date();
  dueAt.setDate(dueAt.getDate() + (input.dueDays ?? 3));

  const end = startTimer();
  const res = await fetch(`${BASE}/orders`, {
    method: "POST",
    headers: {
      Authorization: authHeader(pagarMe.apiKey),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      customer: {
        name: input.customerName,
        email: input.customerEmail,
        document: input.customerDocument.replace(/\D/g, ""),
        type: input.customerDocument.replace(/\D/g, "").length > 11 ? "company" : "individual",
      },
      items: [
        {
          amount: input.amountCents,
          description: `Pedido ${input.orderId.slice(0, 8)}`,
          quantity: 1,
          code: input.orderId,
        },
      ],
      payments: [
        {
          payment_method: "boleto",
          boleto: {
            due_at: dueAt.toISOString(),
            instructions: "Pagar até o vencimento",
          },
        },
      ],
      metadata: { order_id: input.orderId, client_id: input.clientId },
    }),
  });

  const body = (await res.json()) as Record<string, unknown>;
  await logIntegration({
    provider: "pagar_me",
    operation: "create_boleto",
    status: res.ok ? "success" : "error",
    response_code: res.status,
    duration_ms: end(),
    client_id: input.clientId,
    error_message: res.ok ? undefined : JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`Pagar.me boleto error: ${JSON.stringify(body)}`);

  const charges = (body.charges ?? []) as Array<Record<string, unknown>>;
  const charge = charges[0] ?? {};
  const lastTx = (charge.last_transaction ?? {}) as Record<string, unknown>;

  return {
    boletoUrl: String(lastTx.url ?? lastTx.pdf ?? ""),
    dueAt: String(lastTx.due_at ?? dueAt.toISOString()),
    chargeId: String(charge.id ?? body.id ?? ""),
  };
}

export async function regenerateBoletoCharge(input: {
  orderId: string;
  clientId: string;
  amountCents: number;
  customerEmail: string;
  customerName: string;
  customerDocument: string;
}): Promise<BoletoChargeResult> {
  return createBoletoCharge({ ...input, dueDays: 3 });
}
