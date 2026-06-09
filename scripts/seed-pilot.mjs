/**
 * Seed script — Loja Piloto para Fase 0
 *
 * Usage:
 *   node scripts/seed-pilot.mjs
 *
 * Requires in .env (or environment):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   PILOT_USER_ID (optional) — auth.users UUID to link as client admin
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = join(__dir, "..");

function loadEnv() {
  try {
    const raw = readFileSync(join(root, ".env"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z_]+)="?([^"]+)"?$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {
    // .env optional if vars already exported
  }
}

loadEnv();

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const pilotUserId = process.env.PILOT_USER_ID;

if (!url || !key) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

const HOMOLOG_CNPJ = "00000000000191";

async function main() {
  console.log("Seeding Loja Piloto…");

  const { data: existing } = await supabase
    .from("clients")
    .select("id")
    .eq("slug", "loja-piloto")
    .maybeSingle();

  let clientId = existing?.id;

  if (!clientId) {
    const { data: client, error } = await supabase
      .from("clients")
      .insert({
        name: "Loja Piloto",
        slug: "loja-piloto",
        plan: "growth",
        segment: "Moda",
        status: "active",
        health_score: 75,
      })
      .select("id")
      .single();

    if (error) throw error;
    clientId = client.id;
    console.log("  + client criado:", clientId);
  } else {
    console.log("  = client existente:", clientId);
  }

  await supabase.from("fiscal_configs").upsert(
    {
      client_id: clientId,
      cnpj: HOMOLOG_CNPJ,
      company_name: "Loja Piloto LTDA",
      tax_regime: "simples",
      default_cfop: "5102",
      default_cst: "102",
      default_ncm: "61091000",
    },
    { onConflict: "client_id" },
  );
  console.log("  + fiscal_configs");

  const skus = [
    { sku: "CAM-001", product: "Camiseta Básica", units: 120 },
    { sku: "CAL-002", product: "Calça Jeans", units: 45 },
    { sku: "TEN-003", product: "Tênis Casual", units: 8 },
  ];

  for (const item of skus) {
    await supabase
      .from("inventory")
      .upsert({ client_id: clientId, ...item, reserved: 0 }, { onConflict: "client_id,sku" });
  }
  console.log("  + inventory (3 SKUs, reserved=0)");

  const { data: existingFlow } = await supabase
    .from("automation_flows")
    .select("id")
    .eq("client_id", clientId)
    .eq("trigger", "pedido_entregue")
    .eq("channel", "email")
    .maybeSingle();

  if (!existingFlow) {
    await supabase.from("automation_flows").insert({
      client_id: clientId,
      name: "Email pós-entrega",
      trigger: "pedido_entregue",
      channel: "email",
      is_active: true,
      sent_30d: 0,
      recovered: 0,
    });
  }
  console.log("  + automation_flow (pedido_entregue / email)");

  const campaigns = [
    {
      client_id: clientId,
      external_id: "camp-meta-piloto",
      name: "Meta — Conversão Piloto",
      platform: "meta",
      status: "ativa",
      spend_cents: 150000,
      revenue_cents: 900000,
      roas: 6.0,
    },
    {
      client_id: clientId,
      external_id: "camp-google-piloto",
      name: "Google — Search Piloto",
      platform: "google",
      status: "ativa",
      spend_cents: 80000,
      revenue_cents: 400000,
      roas: 5.0,
    },
  ];

  for (const c of campaigns) {
    await supabase.from("campaigns").upsert(c, { onConflict: "client_id,platform,external_id" });
  }
  console.log("  + campaigns (2)");

  if (pilotUserId) {
    await supabase.from("client_members").upsert(
      {
        client_id: clientId,
        user_id: pilotUserId,
        role: "admin",
        status: "active",
      },
      { onConflict: "client_id,user_id" },
    );
    console.log("  + client_members linked to", pilotUserId);
  } else {
    console.log("  (skip client_members — set PILOT_USER_ID to link a user)");
  }

  console.log("\nDone. Client ID:", clientId);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
