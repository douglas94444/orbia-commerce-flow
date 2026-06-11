import { createHmac, timingSafeEqual } from "node:crypto";
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
  input: {
    toPostalCode: string;
    weightKg: number;
    lengthCm?: number;
    widthCm?: number;
    heightCm?: number;
  },
): Promise<ShipmentQuote[]> {
  const { melhorEnvio } = getServerConfig();
  const fromPostal = melhorEnvio.fromPostalCode ?? "01310100";
  const length = input.lengthCm ?? 16;
  const width = input.widthCm ?? 11;
  const height = input.heightCm ?? 2;

  const res = await meFetch<{ data?: ShipmentQuote[] } | ShipmentQuote[]>(
    "/shipment/calculate",
    accessToken,
    {
      method: "POST",
      body: JSON.stringify({
        from: { postal_code: fromPostal },
        to: { postal_code: input.toPostalCode },
        products: [
          {
            weight: input.weightKg,
            width,
            height,
            length,
            insurance_value: 0,
            quantity: 1,
          },
        ],
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
  url?: string;
}

export async function purchaseLabel(
  accessToken: string,
  shipmentId: string,
): Promise<PurchaseLabelResult> {
  const checkout = await meFetch<{
    purchase?: { id: string };
    tracking?: string;
    protocol?: string;
    id?: string;
  }>("/shipment/checkout", accessToken, {
    method: "POST",
    body: JSON.stringify({ orders: [shipmentId] }),
  });

  const orderId = checkout.purchase?.id ?? checkout.id ?? shipmentId;
  const tracking = checkout.tracking ?? "";
  const protocol = checkout.protocol ?? shipmentId;

  let labelUrl: string | undefined;
  try {
    await meFetch("/shipment/generate", accessToken, {
      method: "POST",
      body: JSON.stringify({ orders: [orderId] }),
    });
    const print = await meFetch<{ url?: string } | Array<{ url?: string }>>(
      "/shipment/print",
      accessToken,
      {
        method: "POST",
        body: JSON.stringify({ orders: [orderId], mode: "private" }),
      },
    );
    if (Array.isArray(print)) {
      labelUrl = print[0]?.url;
    } else {
      labelUrl = print.url;
    }
  } catch {
    // generate/print may fail in sandbox — tracking still valid
  }

  if (!tracking) {
    throw new Error("Melhor Envio não retornou código de rastreio");
  }

  return {
    id: orderId,
    tracking,
    protocol,
    url: labelUrl,
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
  const res = await meFetch<{ status?: string; tracking?: string }>(
    `/shipment/tracking/${shipmentId}`,
    accessToken,
  );
  return { status: res.status ?? "unknown", tracking: res.tracking ?? shipmentId };
}

export function validateMelhorEnvioWebhook(
  rawBody: string,
  signature: string | null,
  secret: string | undefined,
): boolean {
  if (!secret) return true;
  if (!signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return expected === signature;
  }
}
