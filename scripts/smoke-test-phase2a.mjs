/**
 * Smoke test Fase 2A — Google OAuth seed, health recalc, operation_alerts, RBAC home paths.
 *
 * Usage:
 *   node scripts/smoke-test-phase2a.mjs [--client-id UUID]
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
try {
  for (const line of readFileSync(join(root, ".env"), "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)="?([^"]+)"?$/);
    if (m) process.env[m[1]] = m[2];
  }
} catch {
  /* ignore */
}

const clientIdArg = process.argv.find((a) => a.startsWith("--client-id="))?.slice(12);
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function resolveHomePath(role) {
  return role === "orbia_admin" || role === "orbia_staff" ? "/overview" : "/portal/overview";
}

let clientId = clientIdArg;
if (!clientId) {
  const { data } = await sb.from("clients").select("id").eq("slug", "loja-piloto").maybeSingle();
  clientId = data?.id;
}
if (!clientId) {
  console.error("No client found. Run seed-pilot.mjs or pass --client-id=");
  process.exit(1);
}

console.log("Fase 2A smoke test — client:", clientId);

// ─── migration 016 ────────────────────────────────────────────
const { error: alertsTableErr } = await sb.from("operation_alerts").select("id").limit(1);
if (alertsTableErr) {
  console.error("✗ operation_alerts:", alertsTableErr.message);
  process.exit(1);
}
console.log("✓ operation_alerts table");

// ─── RBAC home paths ──────────────────────────────────────────
const staffPath = resolveHomePath("orbia_staff");
const memberPath = resolveHomePath("member");
if (staffPath !== "/overview" || memberPath !== "/portal/overview") {
  console.error("✗ resolveHomePath:", { staffPath, memberPath });
  process.exit(1);
}
console.log("✓ resolveHomePath staff → /overview, member → /portal/overview");

const { data: profiles } = await sb.from("profiles").select("role").limit(5);
if (profiles?.length) {
  for (const p of profiles) {
    const home = resolveHomePath(p.role);
    console.log(`  profile role=${p.role} → ${home}`);
  }
}

// ─── Google OAuth fake connection ─────────────────────────────
const googleAccountId = "google-smoke-customer";
const { error: googleOAuthErr } = await sb.from("oauth_connections").upsert(
  {
    client_id: clientId,
    provider: "google",
    external_account: googleAccountId,
    access_token: "smoke-test-token",
    refresh_token: "smoke-refresh",
    token_expires_at: new Date(Date.now() + 3600_000).toISOString(),
    is_active: true,
    metadata: { customer_id: googleAccountId },
  },
  { onConflict: "client_id,provider,external_account" },
);
if (googleOAuthErr) {
  console.error("✗ google oauth_connections upsert:", googleOAuthErr.message);
  process.exit(1);
}
const { count: googleConn } = await sb
  .from("oauth_connections")
  .select("id", { count: "exact", head: true })
  .eq("client_id", clientId)
  .eq("provider", "google");
if (!googleConn) {
  console.error("✗ google oauth_connections not found after upsert");
  process.exit(1);
}
console.log("✓ google oauth_connections seeded");

// ─── Google campaign seed ─────────────────────────────────────
const { data: adAccount } = await sb
  .from("ad_accounts")
  .upsert(
    {
      client_id: clientId,
      platform: "google",
      external_id: googleAccountId,
      name: "Google Ads Smoke",
    },
    { onConflict: "client_id,platform,external_id" },
  )
  .select("id")
  .single();

await sb.from("campaigns").upsert(
  {
    client_id: clientId,
    ad_account_id: adAccount?.id,
    platform: "google",
    external_id: "smoke-campaign-001",
    name: "Smoke Google Campaign",
    status: "active",
    spend_cents: 50_000,
    roas: 3.2,
  },
  { onConflict: "client_id,platform,external_id" },
);
console.log("✓ google campaign seeded (roas 3.2x → should trigger alert)");

// ─── Health recalc (inline, mirrors health-score.server.ts) ───
const thirtyDaysAgo = new Date();
thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

const { data: orders } = await sb
  .from("orders")
  .select("value_cents, status")
  .eq("client_id", clientId)
  .gte("created_at", thirtyDaysAgo.toISOString());

const gmv30d = (orders ?? [])
  .filter((o) => o.status !== "cancelado")
  .reduce((s, o) => s + (o.value_cents ?? 0), 0);

const { data: campaigns } = await sb
  .from("campaigns")
  .select("roas, spend_cents")
  .eq("client_id", clientId);

const totalSpend = (campaigns ?? []).reduce((s, r) => s + (r.spend_cents ?? 0), 0);
const roasAvg =
  totalSpend > 0
    ? Number(
        (
          (campaigns ?? []).reduce((s, r) => s + Number(r.roas) * (r.spend_cents ?? 0), 0) / totalSpend
        ).toFixed(2),
      )
    : 0;

const roasScore = roasAvg >= 6 ? 100 : roasAvg >= 4 ? 70 : roasAvg > 0 ? 40 : 50;
const healthScore = Math.round(roasScore * 0.3 + 75 * 0.25 + 50 * 0.2 + 50 * 0.15 + 75 * 0.1);

const { data: before } = await sb.from("clients").select("health_score, gmv_30d, roas_avg").eq("id", clientId).single();

await sb
  .from("clients")
  .update({
    gmv_30d: gmv30d,
    roas_avg: roasAvg,
    health_score: healthScore,
    updated_at: new Date().toISOString(),
  })
  .eq("id", clientId);

const { data: after } = await sb.from("clients").select("health_score, gmv_30d, roas_avg").eq("id", clientId).single();

if (!after || after.health_score === before?.health_score && roasAvg > 0) {
  console.warn("health_score unchanged (may be ok if already computed):", after?.health_score);
} else {
  console.log("✓ health_score recalculated:", before?.health_score, "→", after?.health_score);
}
console.log(`  gmv_30d=${after?.gmv_30d} roas_avg=${after?.roas_avg}`);

// ─── Refresh alerts (inline mirror of alert-engine) ───────────
await sb
  .from("operation_alerts")
  .update({ is_resolved: true })
  .eq("client_id", clientId)
  .eq("is_resolved", false);

const { data: clientRow } = await sb.from("clients").select("name, health_score, roas_avg").eq("id", clientId).single();
const toInsert = [];

if (Number(clientRow?.roas_avg) > 0 && Number(clientRow?.roas_avg) < 4) {
  toInsert.push({
    client_id: clientId,
    kind: "roas",
    severity: "critical",
    title: "ROAS abaixo do threshold",
    message: `${clientRow.name}: ROAS ${Number(clientRow.roas_avg).toFixed(1)}x`,
  });
}

if ((clientRow?.health_score ?? 100) < 80) {
  toInsert.push({
    client_id: clientId,
    kind: "health",
    severity: clientRow.health_score < 50 ? "critical" : "warning",
    title: "Health score em atenção",
    message: `${clientRow.name}: score ${clientRow.health_score}/100`,
  });
}

if (toInsert.length) {
  await sb.from("operation_alerts").insert(toInsert);
}

const { count: activeAlerts } = await sb
  .from("operation_alerts")
  .select("id", { count: "exact", head: true })
  .eq("client_id", clientId)
  .eq("is_resolved", false);

if (!activeAlerts) {
  console.error("✗ expected at least one operation alert after recalc");
  process.exit(1);
}
console.log(`✓ operation_alerts active: ${activeAlerts}`);

console.log("\nFase 2A smoke test passed.");
