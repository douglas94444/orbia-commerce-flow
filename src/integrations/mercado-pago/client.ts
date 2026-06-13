import { getServerConfig } from "@/lib/config.server";
import { logIntegration, startTimer } from "@/shared/lib/logger";

const API_BASE = "https://api.mercadopago.com";

async function mpFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const { mercadoPago } = getServerConfig();
  if (!mercadoPago.accessToken) throw new Error("MP_ACCESS_TOKEN not configured");

  const end = startTimer();
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${mercadoPago.accessToken}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  await logIntegration({
    provider: "mercado_pago",
    operation: `${init?.method ?? "GET"} ${path}`,
    status: res.ok ? "success" : "error",
    response_code: res.status,
    duration_ms: end(),
    error_message: res.ok ? undefined : String(text).slice(0, 500),
  });

  if (!res.ok) throw new Error(`Mercado Pago API ${res.status}: ${String(text).slice(0, 200)}`);
  return body as T;
}

export interface MpPreapprovalResponse {
  id: string;
  init_point: string;
  status: string;
}

export async function createPreapproval(input: {
  reason: string;
  payerEmail: string;
  externalReference: string;
  amountCents: number;
  backUrl: string;
}): Promise<MpPreapprovalResponse> {
  return mpFetch<MpPreapprovalResponse>("/preapproval", {
    method: "POST",
    body: JSON.stringify({
      reason: input.reason,
      external_reference: input.externalReference,
      payer_email: input.payerEmail,
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: input.amountCents / 100,
        currency_id: "BRL",
      },
      back_url: input.backUrl,
      status: "pending",
    }),
  });
}

export async function getPreapproval(id: string): Promise<Record<string, unknown>> {
  return mpFetch<Record<string, unknown>>(`/preapproval/${id}`);
}

export async function cancelPreapproval(id: string): Promise<void> {
  await mpFetch(`/preapproval/${id}`, {
    method: "PUT",
    body: JSON.stringify({ status: "cancelled" }),
  });
}

export async function getPayment(id: string): Promise<Record<string, unknown>> {
  return mpFetch<Record<string, unknown>>(`/v1/payments/${id}`);
}

export interface MpPreferenceResponse {
  id: string;
  init_point: string;
}

export async function createPreference(input: {
  title: string;
  amountCents: number;
  payerEmail: string;
  externalReference: string;
  backUrl: string;
}): Promise<MpPreferenceResponse> {
  return mpFetch<MpPreferenceResponse>("/checkout/preferences", {
    method: "POST",
    body: JSON.stringify({
      items: [
        {
          title: input.title,
          quantity: 1,
          unit_price: input.amountCents / 100,
          currency_id: "BRL",
        },
      ],
      payer: { email: input.payerEmail },
      external_reference: input.externalReference,
      back_urls: { success: input.backUrl, failure: input.backUrl, pending: input.backUrl },
      auto_return: "approved",
    }),
  });
}
