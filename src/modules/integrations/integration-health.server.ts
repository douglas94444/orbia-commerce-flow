import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logJob, startTimer } from "@/shared/lib/logger";

const MARKETPLACE_PROVIDERS = [
  "nuvemshop",
  "shopify",
  "mercado_livre",
  "shopee",
  "amazon",
  "tiktok",
  "instagram",
] as const;

export type IntegrationHealthStatus = "healthy" | "degraded" | "down" | "unknown";

export interface IntegrationHealthRow {
  provider: string;
  status: IntegrationHealthStatus;
  lastWebhookAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  tokenExpiresAt: string | null;
  failureStreak: number;
}

function deriveStatus(input: {
  isActive: boolean;
  tokenExpiresAt: string | null;
  lastWebhookAt: string | null;
  recentErrors: number;
  failureStreak: number;
}): IntegrationHealthStatus {
  if (!input.isActive) return "unknown";
  if (input.failureStreak >= 3 || input.recentErrors >= 5) return "down";
  if (input.tokenExpiresAt && new Date(input.tokenExpiresAt) < new Date()) return "down";
  const staleWebhook =
    input.lastWebhookAt &&
    Date.now() - new Date(input.lastWebhookAt).getTime() > 7 * 24 * 60 * 60_000;
  if (staleWebhook || input.recentErrors > 0) return "degraded";
  return "healthy";
}

export async function refreshIntegrationHealth(clientId?: string): Promise<{ updated: number }> {
  let query = supabaseAdmin
    .from("oauth_connections")
    .select("client_id, provider, is_active, token_expires_at, updated_at")
    .in("provider", [...MARKETPLACE_PROVIDERS]);

  if (clientId) query = query.eq("client_id", clientId);

  const { data: connections } = await query;
  let updated = 0;

  for (const conn of connections ?? []) {
    const provider = conn.provider as string;
    const cid = conn.client_id as string;

    const since = new Date(Date.now() - 24 * 60 * 60_000).toISOString();

    const { data: lastWebhook } = await supabaseAdmin
      .from("webhook_events")
      .select("created_at")
      .eq("provider", provider)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { count: errorCount } = await supabaseAdmin
      .from("integration_logs")
      .select("id", { count: "exact", head: true })
      .eq("client_id", cid)
      .eq("provider", provider)
      .eq("status", "error")
      .gte("created_at", since);

    const { data: lastSuccess } = await supabaseAdmin
      .from("integration_logs")
      .select("created_at")
      .eq("client_id", cid)
      .eq("provider", provider)
      .eq("status", "success")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: lastErrorRow } = await supabaseAdmin
      .from("integration_logs")
      .select("error_message, created_at")
      .eq("client_id", cid)
      .eq("provider", provider)
      .eq("status", "error")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: existing } = await supabaseAdmin
      .from("integration_health_snapshots")
      .select("failure_streak")
      .eq("client_id", cid)
      .eq("provider", provider)
      .maybeSingle();

    const recentErrors = errorCount ?? 0;
    const prevStreak = (existing?.failure_streak as number) ?? 0;
    const failureStreak = recentErrors > 0 ? prevStreak + 1 : 0;

    const status = deriveStatus({
      isActive: Boolean(conn.is_active),
      tokenExpiresAt: conn.token_expires_at as string | null,
      lastWebhookAt: lastWebhook?.created_at as string | null,
      recentErrors,
      failureStreak,
    });

    await supabaseAdmin.from("integration_health_snapshots").upsert(
      {
        client_id: cid,
        provider,
        status,
        last_webhook_at: lastWebhook?.created_at ?? null,
        last_success_at: lastSuccess?.created_at ?? null,
        last_error: (lastErrorRow?.error_message as string) ?? null,
        token_expires_at: conn.token_expires_at as string | null,
        failure_streak: failureStreak,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "client_id,provider" },
    );

    if (status === "down" && failureStreak >= 3) {
      const { notifyIntegrationDown } = await import(
        "@/modules/logistics/notifications/whatsapp-alerts.server"
      );
      await notifyIntegrationDown(cid, provider).catch(() => undefined);
    }

    updated += 1;
  }

  return { updated };
}

export async function runIntegrationHealthJob(): Promise<{ updated: number }> {
  const end = startTimer();
  const result = await refreshIntegrationHealth();
  await logJob({
    job_type: "integration-health",
    job_id: `integration-health-${Date.now()}`,
    status: "completed",
    duration_ms: end(),
    metadata: result,
  });
  return result;
}

export async function getIntegrationHealthForClient(
  clientId: string,
): Promise<IntegrationHealthRow[]> {
  const { data } = await supabaseAdmin
    .from("integration_health_snapshots")
    .select("provider, status, last_webhook_at, last_success_at, last_error, token_expires_at, failure_streak")
    .eq("client_id", clientId);

  return (data ?? []).map((r) => ({
    provider: r.provider as string,
    status: r.status as IntegrationHealthStatus,
    lastWebhookAt: r.last_webhook_at as string | null,
    lastSuccessAt: r.last_success_at as string | null,
    lastError: r.last_error as string | null,
    tokenExpiresAt: r.token_expires_at as string | null,
    failureStreak: r.failure_streak as number,
  }));
}
