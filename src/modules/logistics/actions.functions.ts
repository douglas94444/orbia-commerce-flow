import { createServerFn } from '@tanstack/react-start'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'
import type { Order, OrderStatus, NfStatus, SalesChannel, InventoryItem } from '@/shared/types/orbia'

// ─── Channel map ─────────────────────────────────────────────
const CHANNEL: Record<string, SalesChannel> = {
  mercado_livre: 'Mercado Livre',
  shopee:        'Shopee',
  amazon:        'Amazon BR',
  tiktok:        'TikTok Shop',
  instagram:     'Instagram',
  nuvemshop:     'Nuvemshop',
  shopify:       'Shopify',
}

// ─── listOrders ───────────────────────────────────────────────

export const listOrders = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Order[]> => {
    const { data, error } = await context.supabase
      .from('orders')
      .select('external_id, channel, status, nf_status, carrier, value_cents, city, clients(name)')
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) throw new Error(error.message)

    return (data ?? []).map((row: {
      external_id: string
      channel: string
      status: string
      nf_status: string
      carrier: string | null
      value_cents: number
      city: string | null
      clients: { name: string } | null
    }): Order => ({
      id:      row.external_id,
      client:  row.clients?.name ?? '—',
      channel: CHANNEL[row.channel] ?? (row.channel as SalesChannel),
      carrier: row.carrier ?? '—',
      status:  row.status as OrderStatus,
      nf:      row.nf_status as NfStatus,
      value:   Math.round(row.value_cents / 100),
      city:    row.city ?? '—',
    }))
  })

// ─── getLogisticsStats ────────────────────────────────────────

export interface LogisticsStats {
  todayCount:   number
  awaitingNf:   number
  slaPercent:   number
  criticalSkus: number
}

export const getLogisticsStats = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<LogisticsStats> => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const [ordersResult, inventoryResult] = await Promise.all([
      context.supabase.from('orders').select('status, nf_status, created_at'),
      context.supabase.from('inventory').select('units'),
    ])

    const orders = ordersResult.data ?? []
    const inventory = inventoryResult.data ?? []

    const todayCount  = orders.filter((o: { created_at: string }) => new Date(o.created_at) >= today).length
    const awaitingNf  = orders.filter((o: { status: string }) => o.status === 'aguardando_nf').length
    const delivered   = orders.filter((o: { status: string }) => o.status === 'entregue').length
    const total       = orders.length
    const slaPercent  = total > 0 ? Math.round((delivered / total) * 100 * 10) / 10 : 0
    const criticalSkus = inventory.filter((i: { units: number }) => i.units <= 5).length

    return { todayCount, awaitingNf, slaPercent, criticalSkus }
  })

// ─── listInventory ────────────────────────────────────────────

export const listInventory = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<InventoryItem[]> => {
    const { data, error } = await context.supabase
      .from('inventory')
      .select('sku, product, units, clients(name)')
      .order('units', { ascending: true })

    if (error) throw new Error(error.message)

    return (data ?? []).map((row: {
      sku: string
      product: string
      units: number
      clients: { name: string } | null
    }): InventoryItem => ({
      sku:     row.sku,
      product: row.product,
      client:  row.clients?.name ?? '—',
      units:   row.units,
      level:   row.units <= 5 ? 'critico' : row.units <= 20 ? 'atencao' : 'ok',
    }))
  })
