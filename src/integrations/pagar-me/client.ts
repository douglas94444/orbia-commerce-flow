import { getServerConfig } from "@/lib/config.server";
import { logIntegration, startTimer } from "@/shared/lib/logger";

const BASE = "https://api.pagar.me/core/v5";

function authHeader(apiKey: string): string {
  const encoded = Buffer.from(`${apiKey}:`).toString("base64");
  return `Basic ${encoded}`;
}

export interface PagarMePlanResponse {
  id: string;
  name: string;
  url?: string;
}

export async function createSubscriptionLink(input: {
  planName: string;
  amountCents: number;
  customerEmail: string;
  customerName: string;
  metadata?: Record<string, string>;
}): Promise<{ checkoutUrl: string; planId: string }> {
  const { pagarMe } = getServerConfig();
  if (!pagarMe.apiKey) throw new Error("PAGARME_API_KEY não configurada");

  const end = startTimer();
  const res = await fetch(`${BASE}/paymentlinks`, {
    method: "POST",
    headers: {
      Authorization: authHeader(pagarMe.apiKey),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      is_building: false,
      name: input.planName,
      type: "subscription",
      cart_settings: {
        recurrences: [
          {
            plan: {
              name: input.planName,
              billing_type: "prepaid",
              interval: "month",
              interval_count: 1,
              payment_methods: ["credit_card", "boleto"],
              installments: [1],
              pricing_scheme: {
                price: input.amountCents,
                scheme_type: "unit",
              },
            },
          },
        ],
      },
      customer_settings: {
        customer: {
          email: input.customerEmail,
          name: input.customerName,
        },
      },
      metadata: input.metadata ?? {},
    }),
  });

  const body = (await res.json()) as Record<string, unknown>;
  await logIntegration({
    provider: "pagar_me",
    operation: "create_payment_link",
    status: res.ok ? "success" : "error",
    response_code: res.status,
    duration_ms: end(),
    error_message: res.ok ? undefined : JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Pagar.me error: ${JSON.stringify(body)}`);
  }

  const url = String(body.url ?? body.checkout_url ?? "");
  const id = String(body.id ?? "");
  if (!url) throw new Error("Pagar.me não retornou URL de checkout");

  return { checkoutUrl: url, planId: id };
}
