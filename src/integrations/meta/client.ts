import { logIntegration, startTimer } from "@/shared/lib/logger";

const GRAPH_BASE = "https://graph.facebook.com/v21.0";

export async function metaFetch<T>(
  path: string,
  accessToken: string,
  init?: RequestInit,
): Promise<T> {
  const end = startTimer();
  const url = new URL(`${GRAPH_BASE}${path}`);
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
    provider: "meta",
    operation: `${init?.method ?? "GET"} ${path}`,
    status: res.ok ? "success" : "error",
    response_code: res.status,
    duration_ms: end(),
    error_message: res.ok ? undefined : String(text).slice(0, 500),
  });

  if (!res.ok) throw new Error(`Meta API ${res.status}: ${String(text).slice(0, 200)}`);
  return body as T;
}

export interface MetaAdAccount {
  id: string;
  name: string;
  account_id?: string;
}

export async function getMetaAdAccounts(accessToken: string): Promise<MetaAdAccount[]> {
  const res = await metaFetch<{ data: MetaAdAccount[] }>("/me/adaccounts?fields=id,name,account_id", accessToken);
  return res.data ?? [];
}

export interface MetaCampaignRow {
  id: string;
  name: string;
  status: string;
}

export async function getMetaCampaigns(
  adAccountId: string,
  accessToken: string,
): Promise<MetaCampaignRow[]> {
  const accountRef = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;
  const res = await metaFetch<{ data: MetaCampaignRow[] }>(
    `/${accountRef}/campaigns?fields=id,name,status&limit=100`,
    accessToken,
  );
  return res.data ?? [];
}

export interface MetaInsightRow {
  spend: string;
  actions?: Array<{ action_type: string; value: string }>;
  action_values?: Array<{ action_type: string; value: string }>;
}

export async function getCampaignInsights(
  campaignId: string,
  accessToken: string,
): Promise<MetaInsightRow | null> {
  const res = await metaFetch<{ data: MetaInsightRow[] }>(
    `/${campaignId}/insights?fields=spend,actions,action_values&date_preset=last_30d`,
    accessToken,
  );
  return res.data?.[0] ?? null;
}
