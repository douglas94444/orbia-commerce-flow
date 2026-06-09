/**
 * Smoke test Fase 1 — ML/Shopee webhook payloads, reserva de estoque, tracking simulado.
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

// ─── Stock RPCs ───────────────────────────────────────────────
const { error: reserveErr } = await sb.rpc("reserve_inventory", {
  p_client_id: clientId,
  p_sku: "CAM-001",
  p_qty: 1,
});
if (reserveErr) {
  console.warn("reserve_inventory:", reserveErr.message, "(apply migration 014 if missing)");
} else {
  console.log("✓ reserve_inventory CAM-001 x1");
  await sb.rpc("release_inventory", { p_client_id: clientId, p_sku: "CAM-001", p_qty: 1 });
  console.log("✓ release_inventory CAM-001 x1");
}

// ─── ML webhook payload ───────────────────────────────────────
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
const mlPayload = {
  user_id: mlSellerId,
  topic: "orders_v2",
  data: {
    id: mlOrderId,
    status: "paid",
    total_amount: 149.9,
    order_items: [{ quantity: 1, unit_price: 149.9, item: { seller_sku: "CAM-001", title: "Camiseta" } }],
    shipping: { receiver_address: { city: { name: "São Paulo" } } },
    buyer: { email: "smoke-test@example.com" },
  },
};

const { data: mlEvent } = await sb
  .from("webhook_events")
  .insert({
    provider: "mercado_livre",
    event_id: `ml-smoke-${Date.now()}`,
    event_type: "orders_v2",
    client_id: clientId,
    payload: mlPayload,
    status: "queued",
  })
  .select("id")
  .single();

console.log("✓ ML webhook event:", mlEvent?.id);

// ─── Shopee webhook payload ───────────────────────────────────
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
const shopeePayload = {
  code: "order_status_push",
  shop_id: shopeeShopId,
  data: {
    order_sn: shopeeOrderSn,
    order_status: "READY_TO_SHIP",
    shop_id: shopeeShopId,
    total_amount: 89.9,
    item_list: [{ item_sku: "CAL-002", item_name: "Calça", model_quantity_purchased: 1, model_discounted_price: 89.9 }],
    recipient_address: { city: "Curitiba" },
  },
};

const { data: spEvent } = await sb
  .from("webhook_events")
  .insert({
    provider: "shopee",
    event_id: `${shopeeOrderSn}-order_status_push`,
    event_type: "order_status_push",
    client_id: clientId,
    payload: shopeePayload,
    status: "queued",
  })
  .select("id")
  .single();

console.log("✓ Shopee webhook event:", spEvent?.id);

// ─── Simulated dispatch + delivery order ──────────────────────
const { data: sepOrder } = await sb
  .from("orders")
  .upsert(
    {
      client_id: clientId,
      external_id: `smoke-dispatch-${Date.now()}`,
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
  await sb
    .from("orders")
    .update({
      status: "entregue",
      tracking_code: `SMOKE${Date.now()}`,
      shipment_external_id: `mock-${sepOrder.id}`,
      carrier: "Melhor Envio (smoke)",
    })
    .eq("id", sepOrder.id);
  console.log("✓ Simulated delivered order:", sepOrder.id);
}

// ─── Automation flow seed check ───────────────────────────────
const { count: flowCount } = await sb
  .from("automation_flows")
  .select("id", { count: "exact", head: true })
  .eq("client_id", clientId)
  .eq("trigger", "pedido_entregue");

console.log("automation_flows pedido_entregue:", flowCount ?? 0);

// ─── Schema checks ────────────────────────────────────────────
const { error: trackErr } = await sb.from("orders").select("tracking_code, shipment_external_id").limit(1);
console.log("tracking columns:", trackErr ? `MISSING (${trackErr.message})` : "ok");

console.log("\nDone. Process webhook events via app server or mark processed manually.");
console.log("Events queued:", { ml: mlEvent?.id, shopee: spEvent?.id });
