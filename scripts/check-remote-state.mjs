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

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const { error: certErr } = await sb.from('fiscal_configs').select('cert_path').limit(1)
console.log('cert_path:', certErr ? `MISSING (${certErr.message})` : 'ok')

const { data: buckets } = await sb.storage.listBuckets()
console.log('buckets:', buckets?.map((b) => b.id).join(', ') || 'none')

const { count: orders } = await sb.from('orders').select('id', { count: 'exact', head: true })
const { count: clients } = await sb.from('clients').select('id', { count: 'exact', head: true })
console.log('clients:', clients, 'orders:', orders)

const { error: rpcErr } = await sb.rpc('reserve_inventory', {
  p_client_id: '00000000-0000-0000-0000-000000000000',
  p_sku: 'test',
  p_qty: 0,
})
console.log('migration 014 (reserve_inventory):', rpcErr?.message?.includes('not found') ? 'MISSING' : 'ok')

const { error: trackErr } = await sb.from('orders').select('tracking_code, shipment_external_id').limit(1)
console.log('migration 015 (tracking columns):', trackErr ? `MISSING (${trackErr.message})` : 'ok')

const { count: flows } = await sb
  .from('automation_flows')
  .select('id', { count: 'exact', head: true })
  .eq('trigger', 'pedido_entregue')
console.log('automation_flows pedido_entregue:', flows ?? 0)

const { error: alertsErr } = await sb.from('operation_alerts').select('id').limit(1)
console.log('migration 016 (operation_alerts):', alertsErr ? `MISSING (${alertsErr.message})` : 'ok')

const { count: googleOAuth } = await sb
  .from('oauth_connections')
  .select('id', { count: 'exact', head: true })
  .eq('provider', 'google')
console.log('google oauth_connections:', googleOAuth ?? 0)

const { error: productsErr } = await sb.from('products').select('id').limit(1)
console.log('migration 018 (products):', productsErr ? `MISSING (${productsErr.message})` : 'ok')

const { error: listingsErr } = await sb.from('channel_listings').select('id').limit(1)
console.log('migration 018 (channel_listings):', listingsErr ? `MISSING (${listingsErr.message})` : 'ok')

const { data: subSample } = await sb.from('subscriptions').select('provider').limit(1)
console.log('migration 017 (mercado_pago provider):', subSample !== null ? 'ok' : 'check')

const { count: whatsappConn } = await sb
  .from('oauth_connections')
  .select('id', { count: 'exact', head: true })
  .eq('provider', 'whatsapp')
console.log('whatsapp oauth_connections:', whatsappConn ?? 0)

const { error: csActErr } = await sb.from('cs_activities').select('id').limit(1)
console.log('migration 020 (cs_activities):', csActErr ? `MISSING (${csActErr.message})` : 'ok')

const { error: onboardErr } = await sb.from('onboarding_tasks').select('id').limit(1)
console.log('migration 020 (onboarding_tasks):', onboardErr ? `MISSING (${onboardErr.message})` : 'ok')

const { error: refreshErr } = await sb.rpc('refresh_client_last_contact', {
  p_client_id: '00000000-0000-0000-0000-000000000000',
})
console.log(
  'migration 020 (refresh_client_last_contact):',
  refreshErr?.message?.includes('not found') ? 'MISSING' : 'ok',
)

const { error: outboxErr } = await sb.from('domain_event_outbox').select('id').limit(1)
console.log('migration 022 (domain_event_outbox):', outboxErr ? `MISSING (${outboxErr.message})` : 'ok')

const { error: recvErr } = await sb.from('receivables').select('id').limit(1)
console.log('migration 022 (receivables):', recvErr ? `MISSING (${recvErr.message})` : 'ok')

const { error: pricingErr } = await sb.from('pricing_recommendations').select('id').limit(1)
console.log('migration 022 (pricing_recommendations):', pricingErr ? `MISSING (${pricingErr.message})` : 'ok')
