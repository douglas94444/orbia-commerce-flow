import { getServerConfig } from "@/lib/config.server";
import { logIntegration, startTimer } from "@/shared/lib/logger";

const API_BASE = "https://melhorenvio.com.br/api/v2/me";

export async function meFetch<T>(
  path: string,
  accessToken: string,
  init?: RequestInit,
): Promise<T> {
  const end = startTimer();
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
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
    provider: "melhor_envio",
    operation: `${init?.method ?? "GET"} ${path}`,
    status: res.ok ? "success" : "error",
    response_code: res.status,
    duration_ms: end(),
    error_message: res.ok ? undefined : String(text).slice(0, 500),
  });

  if (!res.ok) throw new Error(`Melhor Envio API ${res.status}: ${String(text).slice(0, 200)}`);
  return body as T;
}

export interface ShipmentQuote {
  id: number;
  name: string;
  price: string;
  company: { name: string };
}

export async function quoteShipment(
  accessToken: string,
  input: { toPostalCode: string; weightKg: number },
): Promise<ShipmentQuote[]> {
  const { melhorEnvio } = getServerConfig();
  const fromPostal = melhorEnvio.fromPostalCode ?? "01310100";

  const res = await meFetch<{ data?: ShipmentQuote[] } | ShipmentQuote[]>(
    "/shipment/calculate",
    accessToken,
    {
      method: "POST",
      body: JSON.stringify({
        from: { postal_code: fromPostal },
        to: { postal_code: input.toPostalCode },
        products: [{ weight: input.weightKg, width: 11, height: 2, length: 16, insurance_value: 0, quantity: 1 }],
      }),
    },
  );

  if (Array.isArray(res)) return res;
  return res.data ?? [];
}

export interface PurchaseLabelResult {
  id: string;
  tracking: string;
  protocol: string;
}

export async function purchaseLabel(
  accessToken: string,
  shipmentId: string,
): Promise<PurchaseLabelResult> {
  const res = await meFetch<{ purchase?: { id: string }; tracking?: string; protocol?: string }>(
    "/shipment/checkout",
    accessToken,
    {
      method: "POST",
      body: JSON.stringify({ orders: [shipmentId] }),
    },
  );

  return {
    id: res.purchase?.id ?? shipmentId,
    tracking: res.tracking ?? `ME${Date.now()}`,
    protocol: res.protocol ?? shipmentId,
  };
}

export interface TrackingStatus {
  status: string;
  tracking: string;
}

export async function getTracking(
  accessToken: string,
  shipmentId: string,
): Promise<TrackingStatus> {
  try {
    const res = await meFetch<{ status?: string; tracking?: string }>(
      `/shipment/tracking/${shipmentId}`,
      accessToken,
    );
    return { status: res.status ?? "posted", tracking: res.tracking ?? shipmentId };
  } catch {
    return { status: "posted", tracking: shipmentId };
  }
}
