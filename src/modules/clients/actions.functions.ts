import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'
import { supabaseAdmin } from '@/integrations/supabase/client.server'
import { logAudit } from '@/shared/lib/logger'
import type { Tables } from '@/integrations/supabase/types'
import type { Client } from '@/shared/types/orbia'

// ─── Helpers ─────────────────────────────────────────────────

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function toUiClient(row: Tables<'clients'>): Client {
  const words = row.name.trim().split(/\s+/)
  const initials = words
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')

  return {
    id:               row.id,
    name:             row.name,
    initials,
    plan:             row.plan,
    healthScore:      row.health_score,
    gmv30d:           Math.round(row.gmv_30d / 100),   // cents → reais
    roas:             Number(row.roas_avg),
    lastContactDays:  row.last_contact_days,
    onboardingStage:  row.onboarding_week,
    segment:          row.segment ?? 'Geral',
    status:           row.status,
  }
}

// ─── listClients ─────────────────────────────────────────────
// Staff → all clients (RLS resolves via is_orbia_staff)
// Lojista → their own client only (RLS resolves via current_client_id)

export const listClients = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from('clients')
      .select('*')
      .order('health_score', { ascending: false })

    if (error) throw new Error(error.message)
    return (data ?? []).map(toUiClient)
  })

// ─── getPortfolioStats ────────────────────────────────────────

export interface PortfolioStats {
  total:      number
  healthy:    number   // health_score >= 80
  atRisk:     number   // health_score < 50
  onboarding: number
  avgHealth:  number
  avgRoas:    number
}

export const getPortfolioStats = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PortfolioStats> => {
    const { data } = await context.supabase
      .from('clients')
      .select('health_score, roas_avg, status')

    const rows = data ?? []
    const total      = rows.length
    const healthy    = rows.filter((r) => r.health_score >= 80).length
    const atRisk     = rows.filter((r) => r.health_score < 50).length
    const onboarding = rows.filter((r) => r.status === 'onboarding').length
    const avgHealth  = total > 0
      ? Math.round(rows.reduce((s, r) => s + r.health_score, 0) / total)
      : 0
    const avgRoas = total > 0
      ? rows.reduce((s, r) => s + Number(r.roas_avg), 0) / total
      : 0

    return { total, healthy, atRisk, onboarding, avgHealth, avgRoas }
  })

// ─── createClient ─────────────────────────────────────────────

const createClientSchema = z.object({
  name:    z.string().min(2, 'Nome mínimo de 2 caracteres').max(100),
  plan:    z.enum(['launch', 'growth', 'scale']),
  segment: z.string().max(60).optional(),
})

export type CreateClientInput = z.infer<typeof createClientSchema>

export const createClient = createServerFn({ method: 'POST' })
  .inputValidator(createClientSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    // Explicit authorization check (defense in depth — RLS is the primary boundary)
    const { data: profile } = await context.supabase
      .from('profiles')
      .select('role')
      .eq('id', context.userId)
      .single()

    if (!profile || !['orbia_admin', 'orbia_staff'].includes(profile.role)) {
      throw new Error('Apenas membros da equipe Orbia podem criar clientes.')
    }

    const slug = generateSlug(data.name)

    // Use service client for the insert (staff role validation already done above)
    const { data: client, error } = await supabaseAdmin
      .from('clients')
      .insert({
        name:    data.name,
        slug,
        plan:    data.plan,
        segment: data.segment ?? null,
        status:  'onboarding',
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        throw new Error(`Já existe um cliente com o nome "${data.name}".`)
      }
      throw new Error(error.message)
    }

    // Assign current staff member as account manager
    await supabaseAdmin.from('client_members').insert({
      client_id:  client.id,
      user_id:    context.userId,
      role:       'admin',
      status:     'active',
      invited_by: context.userId,
    })

    // Audit trail
    await logAudit({
      user_id:     context.userId,
      client_id:   client.id,
      action:      'client_provision',
      resource:    'client',
      resource_id: client.id,
      new_data:    client,
    })

    return toUiClient(client)
  })
