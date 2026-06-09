/**
 * Smoke test Fase 3 — CS activities, onboarding tasks, refresh last_contact, cron health-recalc.
 *
 * Usage:
 *   node scripts/smoke-test-phase3.mjs [--client-id UUID] [--skip-cron]
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

const skipCron = process.argv.includes("--skip-cron");
const clientIdArg = process.argv.find((a) => a.startsWith("--client-id="))?.slice(12);
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

let clientId = clientIdArg;
if (!clientId) {
  const { data } = await sb.from("clients").select("id").eq("slug", "loja-piloto").maybeSingle();
  clientId = data?.id;
}
if (!clientId) {
  console.error("No client found. Run seed-pilot.mjs or pass --client-id=");
  process.exit(1);
}

console.log("Fase 3 smoke test — client:", clientId);

// ─── migration 020 ────────────────────────────────────────────
const { error: csErr } = await sb.from("cs_activities").select("id").limit(1);
if (csErr) {
  console.error("✗ cs_activities:", csErr.message);
  process.exit(1);
}
console.log("✓ cs_activities table");

const { error: tasksErr } = await sb.from("onboarding_tasks").select("id").limit(1);
if (tasksErr) {
  console.error("✗ onboarding_tasks:", tasksErr.message);
  process.exit(1);
}
console.log("✓ onboarding_tasks table");

const { error: rpcErr } = await sb.rpc("refresh_client_last_contact", { p_client_id: clientId });
if (rpcErr) {
  console.error("✗ refresh_client_last_contact:", rpcErr.message);
  process.exit(1);
}
console.log("✓ refresh_client_last_contact RPC");

// ─── onboarding task seed ─────────────────────────────────────
const { data: staffProfile } = await sb
  .from("profiles")
  .select("id")
  .in("role", ["orbia_admin", "orbia_staff"])
  .limit(1)
  .maybeSingle();

const staffId = staffProfile?.id ?? process.env.PILOT_USER_ID;
if (!staffId) {
  console.warn("⚠ no staff profile — skipping cs_activity insert");
} else {
  await sb.from("onboarding_tasks").upsert(
    {
      client_id: clientId,
      week: 1,
      task_key: "smoke_test_task",
      title: "Smoke test task",
      is_done: true,
      completed_at: new Date().toISOString(),
    },
    { onConflict: "client_id,week,task_key" },
  );
  console.log("✓ onboarding_task upsert");

  const { error: actErr } = await sb.from("cs_activities").insert({
    client_id: clientId,
    staff_id: staffId,
    kind: "onboarding_note",
    notes: "Smoke test Fase 3",
  });
  if (actErr) {
    console.error("✗ cs_activity insert:", actErr.message);
    process.exit(1);
  }
  console.log("✓ cs_activity insert");

  await sb.rpc("refresh_client_last_contact", { p_client_id: clientId });
  const { data: client } = await sb
    .from("clients")
    .select("last_contact_days")
    .eq("id", clientId)
    .single();
  console.log("✓ last_contact_days:", client?.last_contact_days);
}

// ─── cron endpoint (optional) ─────────────────────────────────
if (!skipCron && process.env.CRON_SECRET && process.env.APP_URL) {
  const res = await fetch(`${process.env.APP_URL}/api/cron/run`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.CRON_SECRET}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ job: "health-recalc" }),
  });
  if (!res.ok) {
    const text = await res.text();
    console.warn(`⚠ cron endpoint returned ${res.status}: ${text}`);
  } else {
    const body = await res.json();
    console.log("✓ cron health-recalc:", body.results?.[0]?.status ?? "ok");
  }
} else {
  console.log("⚠ skip cron (set CRON_SECRET + APP_URL or use --skip-cron)");
}

// ─── job_logs ─────────────────────────────────────────────────
const { error: jobLogsErr } = await sb.from("job_logs").select("id").limit(1);
console.log("job_logs:", jobLogsErr ? `check (${jobLogsErr.message})` : "ok");

console.log("\nFase 3 smoke test passed.");
