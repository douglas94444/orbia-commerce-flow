import { logIntegration, startTimer } from "@/shared/lib/logger";

const API_BASE = "https://api.tiendanube.com/v1";

export interface NuvemshopStore {
  id: number;
  name: { pt?: string; es?: string };
  email?: string;
  original_domain?: string;
}

export async function nuvemshopFetch<T>(
  storeId: string,
  accessToken: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const end = startTimer();
  const url = `${API_BASE}/${storeId}${path}`;

  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Orbia (orbia@performanc.com.br)",
      Authorization: `bearer ${accessToken}`,
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
    provider: "nuvemshop",
    operation: `${init?.method ?? "GET"} ${path}`,
    status: res.ok ? "success" : "error",
    response_code: res.status,
    duration_ms: end(),
    error_message: res.ok ? undefined : String(text).slice(0, 500),
  });

  if (!res.ok) {
    throw new Error(`Nuvemshop API ${res.status}: ${String(text).slice(0, 200)}`);
  }

  return body as T;
}

export async function getStore(storeId: string, accessToken: string): Promise<NuvemshopStore> {
  return nuvemshopFetch<NuvemshopStore>(storeId, accessToken, "/store");
}
