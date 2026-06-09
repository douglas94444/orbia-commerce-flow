import { createServerFn } from '@tanstack/react-start'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'
import type { NfEmission, NfStatus } from '@/shared/types/orbia'

// ─── listNfEmissions ──────────────────────────────────────────

export const listNfEmissions = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<NfEmission[]> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (context.supabase as any)
      .from('nfe_emissions')
      .select('id, type, status, value_cents, retries, created_at, clients(name)')
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) throw new Error(error.message)

    return (data ?? []).map((row: {
      id: string
      type: string
      status: string
      value_cents: number
      retries: number
      created_at: string
      clients: { name: string } | null
    }): NfEmission => ({
      id:      row.id.slice(0, 12).toUpperCase(), // short display ID
      client:  row.clients?.name ?? '—',
      type:    row.type as NfEmission['type'],
      status:  row.status as NfStatus,
      value:   Math.round(row.value_cents / 100),
      retries: row.retries,
      time:    new Date(row.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    }))
  })

// ─── getFiscalStats ───────────────────────────────────────────

export interface FiscalStats {
  emitted30d:     number
  successRate:    number   // 0–100
  reprocessing:   number   // status pendente with retries > 0
  rejectedToday:  number
}

export const getFiscalStats = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FiscalStats> => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (context.supabase as any)
      .from('nfe_emissions')
      .select('status, retries, created_at')
      .gte('created_at', thirtyDaysAgo)

    const rows = data ?? []
    const emitted30d    = rows.length
    const authorized    = rows.filter((r: { status: string }) => r.status === 'autorizada').length
    const successRate   = emitted30d > 0 ? Number(((authorized / emitted30d) * 100).toFixed(1)) : 0
    const reprocessing  = rows.filter((r: { status: string; retries: number }) => r.status === 'pendente' && r.retries > 0).length
    const rejectedToday = rows.filter((r: { status: string; created_at: string }) =>
      r.status === 'rejeitada' && new Date(r.created_at) >= today
    ).length

    return { emitted30d, successRate, reprocessing, rejectedToday }
  })
