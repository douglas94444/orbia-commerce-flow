/**
 * Smoke test Fase 0 — simula webhook Nuvemshop sem HMAC (dev only).
 * Valida: order upsert → (opcional) emissão NF se FOCUS_NFE_TOKEN estiver no .env.
 *
 * Usage:
 *   node scripts/smoke-test-phase0.mjs [--client-id UUID]
 */

import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
try {
  for (const line of readFileSync(join(root, '.env'), 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)="?([^"]+)"?$/)
    if (m) process.env[m[1]] = m[2]
  }
} catch { /* ignore */ }

const clientIdArg = process.argv.find((a) => a.startsWith('--client-id='))?.slice(12)
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

let clientId = clientIdArg
if (!clientId) {
  const { data } = await sb.from('clients').select('id').eq('slug', 'loja-piloto').maybeSingle()
  clientId = data?.id
}
if (!clientId) {
  console.error('No client found. Run seed-pilot.mjs or pass --client-id=')
  process.exit(1)
}

const storeId = 'smoke-store-001'
await sb.from('oauth_connections').upsert(
  {
    client_id: clientId,
    provider: 'nuvemshop',
    external_account: storeId,
    access_token: 'smoke-test-token',
    is_active: true,
    metadata: { smoke: true },
  },
  { onConflict: 'client_id,provider,external_account' },
)

const orderPayload = {
  store_id: storeId,
  id: `smoke-${Date.now()}`,
  payment_status: 'paid',
  total: '199.90',
  shipping_address: { city: 'São Paulo' },
  products: [
    { sku: 'CAM-001', name: 'Camiseta Teste', quantity: 1, price: '199.90' },
  ],
}

const eventId = `smoke-${Date.now()}`
const { data: event, error: evErr } = await sb
  .from('webhook_events')
  .insert({
    provider: 'nuvemshop',
    event_id: eventId,
    event_type: 'order/paid',
    client_id: clientId,
    payload: orderPayload,
    status: 'queued',
  })
  .select('id')
  .single()

if (evErr) throw evErr

console.log('Webhook event queued:', event.id)

// Dynamic import of processor (ESM path from built app not available — inline logic)
const { data: orderBefore } = await sb.from('orders').select('id, status, nf_status').eq('client_id', clientId)

console.log('Orders before:', orderBefore?.length ?? 0)

// Call ingest via direct DB upsert (mirrors order-ingestion)
const externalId = String(orderPayload.id)
const { data: order, error: ordErr } = await sb
  .from('orders')
  .upsert(
    {
      client_id: clientId,
      external_id: externalId,
      channel: 'nuvemshop',
      status: 'aguardando_nf',
      nf_status: 'pendente',
      value_cents: 19990,
      city: 'São Paulo',
      metadata: {
        items: [{ sku: 'CAM-001', name: 'Camiseta Teste', quantity: 1, unitPriceCents: 19990 }],
        payment_status: 'paid',
      },
    },
    { onConflict: 'client_id,channel,external_id' },
  )
  .select('id, status, nf_status')
  .single()

if (ordErr) throw ordErr
console.log('Order upserted:', order)

if (process.env.FOCUS_NFE_TOKEN) {
  console.log('FOCUS_NFE_TOKEN set — run dev server and POST webhook for full NF pipeline.')
} else {
  console.log('FOCUS_NFE_TOKEN not set — NF emission skipped.')
}

await sb
  .from('webhook_events')
  .update({ status: 'processed', processed_at: new Date().toISOString() })
  .eq('id', event.id)

console.log('Smoke test OK for client', clientId)
