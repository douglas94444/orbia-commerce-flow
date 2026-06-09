import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getCampaignMetrics, getGoogleCampaigns } from "@/integrations/google";
import { getCampaignInsights, getMetaCampaigns } from "@/integrations/meta";
import { recalculateClientMetrics } from "@/modules/analytics/health-score.server";

function purchaseRevenueCents(insight: {
  action_values?: Array<{ action_type: string; value: string }>;
}): number {
  const purchase = insight.action_values?.find(
    (a) => a.action_type === "purchase" || a.action_type === "omni_purchase",
  );
  return purchase ? Math.round(Number(purchase.value) * 100) : 0;
}

export async function syncMetaCampaigns(clientId: string): Promise<{ synced: number }> {
  const { data: conn, error } = await supabaseAdmin
    .from("oauth_connections")
    .select("access_token, external_account, metadata")
    .eq("client_id", clientId)
    .eq("provider", "meta")
    .eq("is_active", true)
    .maybeSingle();

  if (error || !conn?.access_token) {
    throw new Error("Conta Meta não conectada para este cliente");
  }

  const meta = conn.metadata as { ad_accounts?: Array<{ id: string; name: string }> } | null;
  const adAccountId = meta?.ad_accounts?.[0]?.id ?? conn.external_account;
  const accountExternal = adAccountId.replace(/^act_/, "");

  const { data: adAccount, error: adErr } = await supabaseAdmin
    .from("ad_accounts")
    .upsert(
      {
        client_id: clientId,
        provider: "meta",
        external_id: accountExternal,
        name: meta?.ad_accounts?.[0]?.name ?? "Meta Ads",
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "client_id,provider,external_id" },
    )
    .select("id")
    .single();

  if (adErr || !adAccount) throw new Error(`Failed to upsert ad account: ${adErr?.message}`);

  const campaigns = await getMetaCampaigns(adAccountId, conn.access_token);
  let synced = 0;

  for (const camp of campaigns) {
    const insight = await getCampaignInsights(camp.id, conn.access_token);
    const spendCents = insight ? Math.round(Number(insight.spend) * 100) : 0;
    const revenueCents = insight ? purchaseRevenueCents(insight) : 0;
    const roas = spendCents > 0 ? Number((revenueCents / spendCents).toFixed(2)) : 0;

    const status =
      camp.status === "ACTIVE" ? "ativa" : camp.status === "PAUSED" ? "pausada" : "atencao";

    const { error: campErr } = await supabaseAdmin.from("campaigns").upsert(
      {
        client_id: clientId,
        ad_account_id: adAccount.id,
        external_id: camp.id,
        name: camp.name,
        platform: "meta",
        status,
        spend_cents: spendCents,
        revenue_cents: revenueCents,
        roas,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "client_id,platform,external_id" },
    );

    if (!campErr) synced += 1;
  }

  await recalculateClientMetrics(clientId);
  return { synced };
}

export async function syncGoogleCampaigns(clientId: string): Promise<{ synced: number }> {
  const { data: conn, error } = await supabaseAdmin
    .from("oauth_connections")
    .select("access_token, external_account, metadata")
    .eq("client_id", clientId)
    .eq("provider", "google")
    .eq("is_active", true)
    .maybeSingle();

  if (error || !conn?.access_token) {
    throw new Error("Conta Google Ads não conectada para este cliente");
  }

  const meta = conn.metadata as { customers?: Array<{ id: string; descriptiveName: string }> } | null;
  const customerId = meta?.customers?.[0]?.id ?? conn.external_account;
  const accountExternal = customerId.replace(/-/g, "");

  const { data: adAccount, error: adErr } = await supabaseAdmin
    .from("ad_accounts")
    .upsert(
      {
        client_id: clientId,
        provider: "google",
        external_id: accountExternal,
        name: meta?.customers?.[0]?.descriptiveName ?? "Google Ads",
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "client_id,provider,external_id" },
    )
    .select("id")
    .single();

  if (adErr || !adAccount) throw new Error(`Failed to upsert ad account: ${adErr?.message}`);

  const campaigns = await getGoogleCampaigns(customerId, conn.access_token);
  let synced = 0;

  for (const camp of campaigns) {
    const metrics = await getCampaignMetrics(customerId, camp.id, conn.access_token);
    const roas =
      metrics.spendCents > 0
        ? Number((metrics.revenueCents / metrics.spendCents).toFixed(2))
        : 0;

    const status =
      camp.status === "ENABLED" ? "ativa" : camp.status === "PAUSED" ? "pausada" : "atencao";

    const { error: campErr } = await supabaseAdmin.from("campaigns").upsert(
      {
        client_id: clientId,
        ad_account_id: adAccount.id,
        external_id: String(camp.id),
        name: camp.name,
        platform: "google",
        status,
        spend_cents: metrics.spendCents,
        revenue_cents: metrics.revenueCents,
        roas,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "client_id,platform,external_id" },
    );

    if (!campErr) synced += 1;
  }

  await recalculateClientMetrics(clientId);
  return { synced };
}

export async function syncAllMetaCampaigns(): Promise<{ synced: number; clients: number }> {
  const { data: conns } = await supabaseAdmin
    .from("oauth_connections")
    .select("client_id")
    .eq("provider", "meta")
    .eq("is_active", true);

  let synced = 0;
  const clients = conns?.length ?? 0;

  for (const conn of conns ?? []) {
    const result = await syncMetaCampaigns(conn.client_id);
    synced += result.synced;
  }

  return { synced, clients };
}

export async function syncAllGoogleCampaigns(): Promise<{ synced: number; clients: number }> {
  const { data: conns } = await supabaseAdmin
    .from("oauth_connections")
    .select("client_id")
    .eq("provider", "google")
    .eq("is_active", true);

  let synced = 0;
  const clients = conns?.length ?? 0;

  for (const conn of conns ?? []) {
    const result = await syncGoogleCampaigns(conn.client_id);
    synced += result.synced;
  }

  return { synced, clients };
}
