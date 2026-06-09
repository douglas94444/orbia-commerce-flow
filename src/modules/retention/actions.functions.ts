import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'
import { supabaseAdmin } from '@/integrations/supabase/client.server'
import { logAudit } from '@/shared/lib/logger'
import type { AutomationFlow } from '@/shared/types/orbia'

const CHANNEL_LABEL: Record<string, 'Email' | 'SMS' | 'WhatsApp'> = {
  email:     'Email',
  sms:       'SMS',
  whatsapp:  'WhatsApp',
}

const TRIGGER_LABEL: Record<string, string> = {
  carrinho_abandonado: 'Carrinho > 1h',
  pedido_entregue:     'Pedido entregue',
  reativacao:          'Sem compra 45d',
  aniversario:         'Data aniversário',
  pos_entrega_7d:      'Pedido entregue +7d',
}

// ─── listAutomations ──────────────────────────────────────────

export const listAutomations = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AutomationFlow[]> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (context.supabase as any)
      .from('automation_flows')
      .select('id, name, trigger, channel, is_active, sent_30d, recovered')
      .order('is_active', { ascending: false })
      .order('sent_30d', { ascending: false })

    if (error) throw new Error(error.message)

    return (data ?? []).map((row: {
      id: string
      name: string
      trigger: string
      channel: string
      is_active: boolean
      sent_30d: number
      recovered: number
    }): AutomationFlow => ({
      id:        row.id,
      name:      row.name,
      trigger:   TRIGGER_LABEL[row.trigger] ?? row.trigger,
      channel:   CHANNEL_LABEL[row.channel] ?? 'Email',
      active:    row.is_active,
      sent30d:   row.sent_30d,
      recovered: row.recovered,
    }))
  })

// ─── getRetentionStats ────────────────────────────────────────

export interface RfmSegment {
  label: string
  count: number
  tone:  'success' | 'primary' | 'warning' | 'danger'
  desc:  string
}

export interface RetentionStats {
  avgLtv:         number   // in BRL
  recoveredValue: number   // in BRL (sum of recovered * avg order)
  dispatches30d:  number
  customerCount:  number
  rfm:            RfmSegment[]
}

export const getRetentionStats = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RetentionStats> => {
    const [customersResult, automationsResult] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (context.supabase as any).from('customers').select('rfm_score, ltv_cents'),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (context.supabase as any).from('automation_flows').select('sent_30d, recovered'),
    ])

    const customers  = customersResult.data ?? []
    const automations = automationsResult.data ?? []

    const customerCount  = customers.length
    const avgLtv         = customerCount > 0
      ? Math.round(customers.reduce((s: number, c: { ltv_cents: number }) => s + c.ltv_cents, 0) / customerCount / 100)
      : 0
    const dispatches30d  = automations.reduce((s: number, a: { sent_30d: number }) => s + a.sent_30d, 0)
    const recoveredValue = automations.reduce((s: number, a: { recovered: number }) => s + a.recovered * avgLtv, 0)

    const rfmMap: Record<string, { label: string; tone: RfmSegment['tone']; desc: string }> = {
      campiao:    { label: 'Campeões',   tone: 'success', desc: 'Compram muito e recente' },
      fiel:       { label: 'Fiéis',      tone: 'primary', desc: 'Frequência alta' },
      em_risco:   { label: 'Em risco',   tone: 'warning', desc: 'Recência caindo' },
      hibernando: { label: 'Hibernando', tone: 'danger',  desc: 'Sem compra 90d+' },
    }

    const rfm = Object.entries(rfmMap).map(([key, meta]) => ({
      ...meta,
      count: customers.filter((c: { rfm_score: string }) => c.rfm_score === key).length,
    }))

    return { avgLtv, recoveredValue, dispatches30d, customerCount, rfm }
  })

// ─── toggleAutomation ─────────────────────────────────────────

const toggleSchema = z.object({ id: z.string().uuid(), active: z.boolean() })

export const toggleAutomation = createServerFn({ method: 'POST' })
  .inputValidator(toggleSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabaseAdmin as any)
      .from('automation_flows')
      .update({ is_active: data.active, updated_at: new Date().toISOString() })
      .eq('id', data.id)

    if (error) throw new Error(error.message)

    await logAudit({
      user_id:     context.userId,
      action:      'update',
      resource:    'automation_flow',
      resource_id: data.id,
      new_data:    { is_active: data.active },
    })

    return { success: true }
  })
