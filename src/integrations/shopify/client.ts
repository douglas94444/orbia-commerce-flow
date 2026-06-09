import { logIntegration, startTimer } from "@/shared/lib/logger";

const API_VERSION = "2024-01";

export function shopifyAdminUrl(shop: string, path: string): string {
  const host = shop.includes(".myshopify.com") ? shop : `${shop}.myshopify.com`;
  return `https://${host}/admin/api/${API_VERSION}${path}`;
}

export async function shopifyFetch<T>(
  shop: string,
  accessToken: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const end = startTimer();
  const url = shopifyAdminUrl(shop, path);

  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken,
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
    provider: "shopify",
    operation: `${init?.method ?? "GET"} ${path}`,
    status: res.ok ? "success" : "error",
    response_code: res.status,
    duration_ms: end(),
    error_message: res.ok ? undefined : String(text).slice(0, 500),
  });

  if (!res.ok) {
    throw new Error(`Shopify API ${res.status}: ${String(text).slice(0, 200)}`);
  }

  return body as T;
}
