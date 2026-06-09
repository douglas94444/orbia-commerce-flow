import { createFileRoute } from '@tanstack/react-router'
import { Mail, MessageSquare, Repeat, Smartphone, TrendingUp, Users } from 'lucide-react'
import { PageIntro, Panel } from '@/components/dashboard/panel'
import { KpiCard } from '@/components/dashboard/kpi-card'
import { StatusPill } from '@/components/dashboard/status-pill'
import { formatBRL, formatNumber } from '@/lib/format'
import { useAutomations, useRetentionStats, useToggleAutomation } from '@/modules/retention/hooks/use-retention'

export const Route = createFileRoute('/_dashboard/retention')({
  head: () => ({ meta: [{ title: 'Retenção — Orbia' }] }),
  component: RetentionPage,
})

const CHANNEL_ICON = { Email: Mail, SMS: Smartphone, WhatsApp: MessageSquare } as const

function RetentionPage() {
  const { data: automations = [], isLoading: loadingAuto } = useAutomations()
  const { data: stats,            isLoading: loadingStats } = useRetentionStats()
  const { mutate: toggle, isPending: toggling } = useToggleAutomation()

  const loading = loadingAuto || loadingStats

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Módulo Retenção"
        title="Automações & LTV"
        description="Fluxos disparados por eventos nativos (pedido entregue, carrinho abandonado) e segmentação RFM em tempo real."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label="LTV médio"
          value={loading ? '—' : stats && stats.avgLtv > 0 ? formatBRL(stats.avgLtv) : '—'}
          icon={TrendingUp}
          accent="primary"
        />
        <KpiCard
          label="Receita recuperada"
          value={loading ? '—' : stats && stats.recoveredValue > 0 ? formatBRL(stats.recoveredValue, true) : '—'}
          icon={Repeat}
          accent="success"
        />
        <KpiCard
          label="Disparos (30d)"
          value={loading ? '—' : stats ? formatNumber(stats.dispatches30d) : '—'}
          icon={Mail}
          accent="accent"
        />
        <KpiCard
          label="Base segmentada"
          value={loading ? '—' : stats ? formatNumber(stats.customerCount) : '—'}
          hint="Perfis unificados"
          icon={Users}
          accent="warning"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Panel title="Fluxos de automação" className="lg:col-span-3">
          {loadingAuto ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-muted/40" />)}
            </div>
          ) : automations.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Nenhum fluxo configurado. Conecte um canal de comunicação para ativar automações.
            </div>
          ) : (
            <div className="space-y-3">
              {automations.map((a) => {
                const Icon = CHANNEL_ICON[a.channel]
                return (
                  <div key={a.id} className="flex items-center gap-4 rounded-xl border border-border bg-muted/20 p-4">
                    <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">{a.name}</p>
                      <p className="text-[11px] text-muted-foreground">Gatilho: {a.trigger} · {a.channel}</p>
                    </div>
                    <div className="hidden text-right sm:block">
                      <p className="font-mono text-sm text-foreground">{formatNumber(a.sent30d)}</p>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">disparos</p>
                    </div>
                    <button
                      onClick={() => toggle({ id: a.id, active: !a.active })}
                      disabled={toggling}
                      title={a.active ? 'Pausar' : 'Ativar'}
                    >
                      <StatusPill label={a.active ? 'Ativo' : 'Pausado'} tone={a.active ? 'success' : 'neutral'} dot />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </Panel>

        <Panel title="Segmentação RFM" subtitle="Recência · Frequência · Valor" className="lg:col-span-2">
          {loadingStats ? (
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-muted/40" />)}
            </div>
          ) : !stats || stats.rfm.every((s) => s.count === 0) ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Segmentação disponível após importação de clientes.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {stats.rfm.map((s) => (
                <div key={s.label} className="rounded-xl border border-border bg-muted/20 p-4">
                  <StatusPill label={s.label} tone={s.tone} />
                  <p className="mt-3 font-mono text-xl font-semibold text-foreground">{formatNumber(s.count)}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{s.desc}</p>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  )
}
