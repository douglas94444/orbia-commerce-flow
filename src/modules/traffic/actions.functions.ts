import { createServerFn } from '@tanstack/react-start'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'
import type { Campaign } from '@/shared/types/orbia'

const PLATFORM_LABEL: Record<string, 'Meta Ads' | 'Google Ads'> = {
  meta:   'Meta Ads',
  google: 'Google Ads',
}

// ─── listCampaigns ────────────────────────────────────────────

export const listCampaigns = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Campaign[]> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (context.supabase as any)
      .from('campaigns')
      .select('id, name, platform, status, spend_cents, revenue_cents, roas, clients(name)')
      .order('roas', { ascending: false })

    if (error) throw new Error(error.message)

    return (data ?? []).map((row: {
      id: string
      name: string
      platform: string
      status: string
      spend_cents: number
      revenue_cents: number
      roas: number
      clients: { name: string } | null
    }): Campaign => ({
      id:       row.id,
      name:     row.name,
      client:   row.clients?.name ?? '—',
      platform: PLATFORM_LABEL[row.platform] ?? 'Meta Ads',
      status:   row.status as Campaign['status'],
      spend:    Math.round(row.spend_cents / 100),
      revenue:  Math.round(row.revenue_cents / 100),
      roas:     Number(row.roas),
    }))
  })

// ─── getTrafficStats ──────────────────────────────────────────

export interface TrafficStats {
  avgRoas:       number
  totalSpend:    number   // in BRL
  totalRevenue:  number   // in BRL
  campaignCount: number
  atRisk:        number   // ROAS < 4
}

export const getTrafficStats = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TrafficStats> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (context.supabase as any)
      .from('campaigns')
      .select('spend_cents, revenue_cents, roas, status')

    const rows = data ?? []
    const total       = rows.length
    const totalSpend  = Math.round(rows.reduce((s: number, r: { spend_cents: number }) => s + r.spend_cents, 0) / 100)
    const totalRevenue = Math.round(rows.reduce((s: number, r: { revenue_cents: number }) => s + r.revenue_cents, 0) / 100)
    const avgRoas     = total > 0
      ? Number((rows.reduce((s: number, r: { roas: number }) => s + Number(r.roas), 0) / total).toFixed(1))
      : 0
    const atRisk = rows.filter((r: { roas: number }) => Number(r.roas) < 4).length

    return { avgRoas, totalSpend, totalRevenue, campaignCount: total, atRisk }
  })
