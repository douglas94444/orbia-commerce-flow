/**
 * Smoke test Fase 2B — catálogo, Mercado Pago provider, SKU resolution, WhatsApp flow seed.
 *
 * Usage:
 *   node scripts/smoke-test-phase2b.mjs [--client-id UUID]
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

let clientId = clientIdArg;
if (!clientId) {
  const { data } = await sb.from("clients").select("id").eq("slug", "loja-piloto").maybeSingle();
  clientId = data?.id;
}
if (!clientId) {
  console.error("No client found. Run seed-pilot.mjs or pass --client-id=");
  process.exit(1);
}

console.log("Fase 2B smoke test — client:", clientId);

// ─── migrations 017/018 ───────────────────────────────────────
const { error: productsErr } = await sb.from("products").select("id").limit(1);
if (productsErr) {
  console.error("✗ products:", productsErr.message);
  process.exit(1);
}
console.log("✓ products table");

const { error: listingsErr } = await sb.from("channel_listings").select("id").limit(1);
if (listingsErr) {
  console.error("✗ channel_listings:", listingsErr.message);
  process.exit(1);
}
console.log("✓ channel_listings table");

// ─── seed product + listing for SKU resolution ────────────────
const { data: product } = await sb
  .from("products")
  .upsert(
    {
      client_id: clientId,
      sku: "SMOKE-SKU",
      name: "Produto Smoke 2B",
      ncm: "61091000",
      price_cents: 5000,
      is_active: true,
    },
    { onConflict: "client_id,sku" },
  )
  .select("id")
  .single();

await sb.from("channel_listings").upsert(
  {
    client_id: clientId,
    product_id: product.id,
    channel: "shopify",
    external_product_id: "smoke-prod-001",
    external_variant_id: "smoke-var-001",
    listing_status: "active",
    last_synced_at: new Date().toISOString(),
  },
  { onConflict: "client_id,channel,external_product_id,external_variant_id" },
);
console.log("✓ product + channel_listing seeded");

// SKU resolution simulation
const { data: listing } = await sb
  .from("channel_listings")
  .select("products(sku)")
  .eq("client_id", clientId)
  .eq("channel", "shopify")
  .eq("external_variant_id", "smoke-var-001")
  .maybeSingle();

const resolvedSku = listing?.products?.sku;
if (resolvedSku !== "SMOKE-SKU") {
  console.error("✗ SKU resolution failed:", resolvedSku);
  process.exit(1);
}
console.log("✓ SKU resolution via channel_listings");

// ─── Mercado Pago subscription seed ───────────────────────────
await sb.from("subscriptions").upsert(
  {
    client_id: clientId,
    plan: "growth",
    status: "trialing",
    amount_cents: 900000,
    provider: "mercado_pago",
    provider_sub_id: "mp-smoke-preapproval",
    current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  },
  { onConflict: "client_id" },
);

const { data: sub } = await sb
  .from("subscriptions")
  .select("provider")
  .eq("client_id", clientId)
  .single();

if (sub?.provider !== "mercado_pago") {
  console.error("✗ mercado_pago provider not accepted");
  process.exit(1);
}
console.log("✓ subscription provider mercado_pago");

// ─── WhatsApp flow seed ───────────────────────────────────────
const { data: waFlow } = await sb
  .from("automation_flows")
  .select("id, channel, metadata")
  .eq("client_id", clientId)
  .eq("channel", "whatsapp")
  .maybeSingle();

if (!waFlow) {
  await sb.from("automation_flows").insert({
    client_id: clientId,
    name: "WhatsApp smoke",
    trigger: "pedido_entregue",
    channel: "whatsapp",
    is_active: false,
    metadata: { template_name: "pedido_entregue_obrigado", language: "pt_BR" },
  });
}
console.log("✓ whatsapp automation_flow");

await sb.from("oauth_connections").upsert(
  {
    client_id: clientId,
    provider: "whatsapp",
    external_account: "wa-smoke-phone-id",
    access_token: "smoke-wa-token",
    is_active: true,
    metadata: {
      waba_id: "waba-smoke",
      phone_number_id: "wa-smoke-phone-id",
      display_phone: "+5511999999999",
    },
  },
  { onConflict: "client_id,provider,external_account" },
);
console.log("✓ whatsapp oauth_connection seeded");

console.log("\nFase 2B smoke test passed.");
