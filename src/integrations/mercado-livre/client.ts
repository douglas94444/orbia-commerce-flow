import { logIntegration, startTimer } from "@/shared/lib/logger";

const API_BASE = "https://api.mercadolibre.com";

export async function mlFetch<T>(
  path: string,
  accessToken: string,
  init?: RequestInit,
): Promise<T> {
  const end = startTimer();
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
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
    provider: "mercado_livre",
    operation: `${init?.method ?? "GET"} ${path}`,
    status: res.ok ? "success" : "error",
    response_code: res.status,
    duration_ms: end(),
    error_message: res.ok ? undefined : String(text).slice(0, 500),
  });

  if (!res.ok) throw new Error(`ML API ${res.status}: ${String(text).slice(0, 200)}`);
  return body as T;
}

export async function getOrder(orderId: string, accessToken: string) {
  return mlFetch<Record<string, unknown>>(`/orders/${orderId}`, accessToken);
}

export async function getMe(accessToken: string) {
  return mlFetch<{ id: number; nickname: string }>("/users/me", accessToken);
}
