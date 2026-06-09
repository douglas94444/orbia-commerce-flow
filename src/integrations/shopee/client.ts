import { createHmac } from "node:crypto";
import { getServerConfig } from "@/lib/config.server";
import { logIntegration, startTimer } from "@/shared/lib/logger";

const API_HOST = "https://partner.shopeemobile.com";

function sign(path: string, timestamp: number, accessToken?: string): string {
  const { shopee } = getServerConfig();
  const partnerId = shopee.partnerId ?? "";
  const partnerKey = shopee.partnerKey ?? "";
  const base = accessToken
    ? `${partnerId}${path}${timestamp}${accessToken}`
    : `${partnerId}${path}${timestamp}`;
  return createHmac("sha256", partnerKey).update(base).digest("hex");
}

export async function shopeeFetch<T>(
  path: string,
  shopId: string,
  accessToken: string,
  init?: RequestInit,
): Promise<T> {
  const end = startTimer();
  const timestamp = Math.floor(Date.now() / 1000);
  const { shopee } = getServerConfig();
  const partnerId = shopee.partnerId ?? "";

  const url = new URL(`${API_HOST}${path}`);
  url.searchParams.set("partner_id", partnerId);
  url.searchParams.set("timestamp", String(timestamp));
  url.searchParams.set("sign", sign(path, timestamp, accessToken));
  url.searchParams.set("shop_id", shopId);
  url.searchParams.set("access_token", accessToken);

  const res = await fetch(url.toString(), {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });

  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  await logIntegration({
    provider: "shopee",
    operation: `${init?.method ?? "GET"} ${path}`,
    status: res.ok ? "success" : "error",
    response_code: res.status,
    duration_ms: end(),
    error_message: res.ok ? undefined : String(text).slice(0, 500),
  });

  if (!res.ok) throw new Error(`Shopee API ${res.status}: ${String(text).slice(0, 200)}`);
  return body as T;
}
