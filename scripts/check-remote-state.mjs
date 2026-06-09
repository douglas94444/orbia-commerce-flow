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
