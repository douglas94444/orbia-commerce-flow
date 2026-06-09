/**
 * Smoke test Fase 1 — ML/Shopee ingestão inline, reserva de estoque, despacho simulado.
 *
 * Usage:
 *   node scripts/smoke-test-phase1.mjs [--client-id UUID]
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

console.log("Fase 1 smoke test — client:", clientId);

async function upsertPaidOrder({ externalId, channel, valueCents, city, items, email }) {
  const metadata = {
    items,
    payment_status: "paid",
    customer_email: email,
  };

  const { data, error } = await sb
    .from("orders")
    .upsert(
      {
        client_id: clientId,
        external_id: externalId,
        channel,
        status: "aguardando_nf",
        nf_status: "pendente",
        value_cents: valueCents,
        city,
        metadata,
      },
      { onConflict: "client_id,channel,external_id" },
    )
    .select("id, status")
    .single();

  if (error) throw error;
  return data;
}

async function reserveItems(items) {
  for (const item of items) {
    const { error } = await sb.rpc("reserve_inventory", {
      p_client_id: clientId,
      p_sku: item.sku,
      p_qty: item.quantity,
    });
    if (error) throw new Error(`reserve ${item.sku}: ${error.message}`);
  }
}

// ─── Stock RPCs ───────────────────────────────────────────────
const { error: reserveErr } = await sb.rpc("reserve_inventory", {
  p_client_id: clientId,
  p_sku: "CAM-001",
  p_qty: 1,
});
if (reserveErr) {
  console.warn("reserve_inventory:", reserveErr.message, "(apply migration 014 if missing)");
  process.exit(1);
}
console.log("✓ reserve_inventory CAM-001 x1");
await sb.rpc("release_inventory", { p_client_id: clientId, p_sku: "CAM-001", p_qty: 1 });
console.log("✓ release_inventory CAM-001 x1");

// ─── ML order ingest ──────────────────────────────────────────
const mlSellerId = "ml-smoke-seller";
await sb.from("oauth_connections").upsert(
  {
    client_id: clientId,
    provider: "mercado_livre",
    external_account: mlSellerId,
    access_token: "smoke-ml-token",
    is_active: true,
    metadata: { smoke: true },
  },
  { onConflict: "client_id,provider,external_account" },
);

const mlOrderId = `ML-${Date.now()}`;
const mlItems = [{ sku: "CAM-001", name: "Camiseta", quantity: 1, unitPriceCents: 14990 }];
const mlOrder = await upsertPaidOrder({
  externalId: mlOrderId,
  channel: "mercado_livre",
  valueCents: 14990,
  city: "São Paulo",
  items: mlItems,
  email: "smoke-test@example.com",
});
await reserveItems(mlItems.map((i) => ({ sku: i.sku, quantity: i.quantity })));
console.log("✓ ML order + stock reserved:", mlOrder.id);

const { data: mlEvent } = await sb
  .from("webhook_events")
  .insert({
    provider: "mercado_livre",
    event_id: `ml-smoke-${Date.now()}`,
    event_type: "orders_v2",
    client_id: clientId,
    payload: { user_id: mlSellerId, topic: "orders_v2", data: { id: mlOrderId, status: "paid" } },
    status: "processed",
    processed_at: new Date().toISOString(),
  })
  .select("id")
  .single();
console.log("✓ ML webhook event:", mlEvent?.id);

// ─── Shopee order ingest ──────────────────────────────────────
const shopeeShopId = "shopee-smoke-shop";
await sb.from("oauth_connections").upsert(
  {
    client_id: clientId,
    provider: "shopee",
    external_account: shopeeShopId,
    access_token: "smoke-shopee-token",
    is_active: true,
    metadata: { smoke: true },
  },
  { onConflict: "client_id,provider,external_account" },
);

const shopeeOrderSn = `SP-${Date.now()}`;
const spItems = [{ sku: "CAL-002", name: "Calça", quantity: 1, unitPriceCents: 8990 }];
const spOrder = await upsertPaidOrder({
  externalId: shopeeOrderSn,
  channel: "shopee",
  valueCents: 8990,
  city: "Curitiba",
  items: spItems,
  email: "smoke-test@example.com",
});
await reserveItems(spItems.map((i) => ({ sku: i.sku, quantity: i.quantity })));
console.log("✓ Shopee order + stock reserved:", spOrder.id);

// ─── Dispatch simulation ─────────────────────────────────────
const dispatchExternalId = `smoke-dispatch-${Date.now()}`;
const { data: sepOrder } = await sb
  .from("orders")
  .upsert(
    {
      client_id: clientId,
      external_id: dispatchExternalId,
      channel: "nuvemshop",
      status: "separacao",
      nf_status: "autorizada",
      value_cents: 19990,
      city: "São Paulo",
      metadata: {
        items: [{ sku: "CAM-001", name: "Camiseta", quantity: 1, unitPriceCents: 19990 }],
        customer_email: "smoke-test@example.com",
      },
    },
    { onConflict: "client_id,channel,external_id" },
  )
  .select("id")
  .single();

if (sepOrder) {
  const tracking = `SMOKE${Date.now()}`;
  await sb
    .from("orders")
    .update({
      status: "despachado",
      tracking_code: tracking,
      shipment_external_id: `mock-${sepOrder.id}`,
      carrier: "Melhor Envio (smoke)",
    })
    .eq("id", sepOrder.id);

  await sb.rpc("commit_inventory", { p_client_id: clientId, p_sku: "CAM-001", p_qty: 1 });
  console.log("✓ Dispatch simulated — tracking:", tracking);

  await sb.from("orders").update({ status: "entregue" }).eq("id", sepOrder.id);
  console.log("✓ Order marked entregue:", sepOrder.id);
}

// ─── Verifications ───────────────────────────────────────────
const { data: inv } = await sb
  .from("inventory")
  .select("sku, units, reserved")
  .eq("client_id", clientId)
  .eq("sku", "CAM-001")
  .single();
console.log("inventory CAM-001:", inv);

const { count: flowCount } = await sb
  .from("automation_flows")
  .select("id", { count: "exact", head: true })
  .eq("client_id", clientId)
  .eq("trigger", "pedido_entregue");
console.log("automation_flows pedido_entregue:", flowCount ?? 0);

const { count: orderCount } = await sb
  .from("orders")
  .select("id", { count: "exact", head: true })
  .eq("client_id", clientId);
console.log("total orders for client:", orderCount);

console.log("\nSmoke test OK.");
