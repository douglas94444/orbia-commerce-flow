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

    await supabase.from("products").upsert(
      {
        client_id: clientId,
        sku: item.sku,
        name: item.product,
        ncm: "61091000",
        price_cents: 9900,
        is_active: true,
      },
      { onConflict: "client_id,sku" },
    );
  }
  console.log("  + inventory + products (3 SKUs)");

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

  const { data: existingWa } = await supabase
    .from("automation_flows")
    .select("id")
    .eq("client_id", clientId)
    .eq("trigger", "pedido_entregue")
    .eq("channel", "whatsapp")
    .maybeSingle();

  if (!existingWa) {
    await supabase.from("automation_flows").insert({
      client_id: clientId,
      name: "WhatsApp pós-entrega",
      trigger: "pedido_entregue",
      channel: "whatsapp",
      is_active: false,
      sent_30d: 0,
      recovered: 0,
      metadata: { template_name: "pedido_entregue_obrigado", language: "pt_BR" },
    });
  }
  console.log("  + automation_flow (pedido_entregue / whatsapp, inativo)");

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

  const ONBOARDING_TASKS = [
    { week: 1, task_key: "oauth_connect", title: "Conectar canais de venda" },
    { week: 1, task_key: "fiscal_config", title: "Configurar dados fiscais" },
    { week: 1, task_key: "team_invite", title: "Convidar equipe do lojista" },
    { week: 1, task_key: "portal_walkthrough", title: "Tour do portal lojista" },
    { week: 2, task_key: "catalog_sync", title: "Sincronizar catálogo" },
    { week: 2, task_key: "meta_connect", title: "Conectar Meta Ads" },
    { week: 2, task_key: "google_connect", title: "Conectar Google Ads" },
    { week: 2, task_key: "first_campaign", title: "Primeira campanha ativa" },
    { week: 3, task_key: "logistics_webhook", title: "Webhooks de pedidos OK" },
    { week: 3, task_key: "test_order", title: "Pedido teste processado" },
    { week: 3, task_key: "nfe_test", title: "NF-e de teste autorizada" },
    { week: 3, task_key: "shipping_connect", title: "Melhor Envio conectado" },
    { week: 4, task_key: "automation_flow", title: "Fluxo de retenção ativo" },
    { week: 4, task_key: "whatsapp_connect", title: "WhatsApp Business conectado" },
    { week: 4, task_key: "billing_setup", title: "Assinatura Orbia ativa" },
    { week: 4, task_key: "qbr_schedule", title: "QBR inicial agendada" },
  ];

  for (const task of ONBOARDING_TASKS) {
    const { data: existing } = await supabase
      .from("onboarding_tasks")
      .select("id")
      .eq("client_id", clientId)
      .eq("week", task.week)
      .eq("task_key", task.task_key)
      .maybeSingle();

    if (!existing) {
      await supabase.from("onboarding_tasks").insert({
        client_id: clientId,
        week: task.week,
        task_key: task.task_key,
        title: task.title,
        is_done: task.week === 1 && task.task_key === "oauth_connect",
      });
    }
  }
  console.log("  + onboarding_tasks (16)");

  if (pilotUserId) {
    const { data: existingActivity } = await supabase
      .from("cs_activities")
      .select("id")
      .eq("client_id", clientId)
      .eq("kind", "contact")
      .limit(1)
      .maybeSingle();

    if (!existingActivity) {
      await supabase.from("cs_activities").insert({
        client_id: clientId,
        staff_id: pilotUserId,
        kind: "contact",
        channel: "call",
        notes: "Kickoff onboarding — Loja Piloto",
      });
      await supabase.rpc("refresh_client_last_contact", { p_client_id: clientId });
      console.log("  + cs_activity (contact)");
    }
  }

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
