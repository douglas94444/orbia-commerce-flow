import { getServerConfig } from "@/lib/config.server";
import { logIntegration, startTimer } from "@/shared/lib/logger";

const API_BASE = "https://googleads.googleapis.com/v18";

function adsHeaders(accessToken: string): Record<string, string> {
  const { google } = getServerConfig();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    "developer-token": google.developerToken ?? "",
  };
  if (google.loginCustomerId) {
    headers["login-customer-id"] = google.loginCustomerId.replace(/-/g, "");
  }
  return headers;
}

export async function googleAdsFetch<T>(
  path: string,
  accessToken: string,
  init?: RequestInit,
): Promise<T> {
  const end = startTimer();
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { ...adsHeaders(accessToken), ...init?.headers },
  });

  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  await logIntegration({
    provider: "google",
    operation: `${init?.method ?? "GET"} ${path}`,
    status: res.ok ? "success" : "error",
    response_code: res.status,
    duration_ms: end(),
    error_message: res.ok ? undefined : String(text).slice(0, 500),
  });

  if (!res.ok) throw new Error(`Google Ads API ${res.status}: ${String(text).slice(0, 200)}`);
  return body as T;
}

export interface GoogleCustomer {
  id: string;
  descriptiveName: string;
}

export async function listAccessibleCustomers(accessToken: string): Promise<GoogleCustomer[]> {
  const res = await googleAdsFetch<{ resourceNames?: string[] }>(
    "/customers:listAccessibleCustomers",
    accessToken,
  );

  return (res.resourceNames ?? []).map((rn) => {
    const id = rn.replace("customers/", "");
    return { id, descriptiveName: `Customer ${id}` };
  });
}

export interface GoogleCampaignRow {
  id: string;
  name: string;
  status: string;
}

export async function getGoogleCampaigns(
  customerId: string,
  accessToken: string,
): Promise<GoogleCampaignRow[]> {
  const cid = customerId.replace(/-/g, "");
  const query = encodeURIComponent(
    "SELECT campaign.id, campaign.name, campaign.status FROM campaign WHERE campaign.status != 'REMOVED'",
  );

  const res = await googleAdsFetch<{
    results?: Array<{ campaign: { id: string; name: string; status: string } }>;
  }>(`/customers/${cid}/googleAds:search`, accessToken, {
    method: "POST",
    body: JSON.stringify({ query: decodeURIComponent(query) }),
  });

  return (res.results ?? []).map((row) => row.campaign).filter(Boolean);
}

export interface GoogleCampaignMetrics {
  spendCents: number;
  revenueCents: number;
}

export async function getCampaignMetrics(
  customerId: string,
  campaignId: string,
  accessToken: string,
): Promise<GoogleCampaignMetrics> {
  const cid = customerId.replace(/-/g, "");
  const gaql = `SELECT metrics.cost_micros, metrics.conversions_value FROM campaign WHERE campaign.id = ${campaignId} AND segments.date DURING LAST_30_DAYS`;

  try {
    const res = await googleAdsFetch<{
      results?: Array<{ metrics?: { costMicros?: string; conversionsValue?: number } }>;
    }>(`/customers/${cid}/googleAds:search`, accessToken, {
      method: "POST",
      body: JSON.stringify({ query: gaql }),
    });

    let spendMicros = 0;
    let revenue = 0;
    for (const row of res.results ?? []) {
      spendMicros += Number(row.metrics?.costMicros ?? 0);
      revenue += Number(row.metrics?.conversionsValue ?? 0);
    }

    return {
      spendCents: Math.round(spendMicros / 10_000),
      revenueCents: Math.round(revenue * 100),
    };
  } catch {
    return { spendCents: 0, revenueCents: 0 };
  }
}
