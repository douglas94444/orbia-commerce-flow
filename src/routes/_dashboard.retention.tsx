import { createFileRoute, Link } from '@tanstack/react-router'
import { Mail, MessageSquare, Repeat, Smartphone, TrendingUp, Users, ExternalLink, Bell } from 'lucide-react'
import { PageIntro, Panel } from '@/components/dashboard/panel'
import { KpiCard } from '@/components/dashboard/kpi-card'
import { StatusPill } from '@/components/dashboard/status-pill'
import { formatBRL, formatNumber } from '@/lib/format'
import {
  useAutomations,
  useRetentionStats,
  useToggleAutomation,
  useLtvAnalytics,
  useTemplateLibrary,
} from '@/modules/retention/hooks/use-retention'
import { FlowEditor } from '@/modules/retention/flow-editor/flow-editor'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export const Route = createFileRoute('/_dashboard/retention')({
  head: () => ({ meta: [{ title: 'Retenção — Orbia' }] }),
  component: RetentionPage,
})

const CHANNEL_ICON = { Email: Mail, SMS: Smartphone, WhatsApp: MessageSquare, Push: Bell } as const

function RetentionPage() {
  const { data: automations = [], isLoading: loadingAuto } = useAutomations()
  const { data: stats, isLoading: loadingStats } = useRetentionStats()
  const { data: ltvAnalytics } = useLtvAnalytics()
  const { data: templates = [] } = useTemplateLibrary()
  const { mutate: toggle, isPending: toggling } = useToggleAutomation()

  const loading = loadingAuto || loadingStats

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageIntro
          eyebrow="Módulo Retenção"
          title="LTV Boost — Automações & WhatsApp"
          description="Fluxos multi-canal com Meta WhatsApp, segmentação RFM, fidelidade e métricas por automação."
        />
        <Link
          to="/portal/settings"
          className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline shrink-0"
        >
          Configurar WhatsApp <ExternalLink className="size-3" />
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label="LTV médio"
          value={loading ? '—' : stats && stats.avgLtv > 0 ? formatBRL(stats.avgLtv) : '—'}
          icon={TrendingUp}
          accent="primary"
        />
        <KpiCard
          label="Receita recuperada"
          value={loading ? '—' : stats ? formatBRL(stats.recoveredValue, true) : '—'}
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

      <Tabs defaultValue="fluxos">
        <TabsList>
          <TabsTrigger value="fluxos">Fluxos</TabsTrigger>
          <TabsTrigger value="rfm">RFM & Ciclo</TabsTrigger>
          <TabsTrigger value="metricas">Métricas</TabsTrigger>
          <TabsTrigger value="editor">Editor</TabsTrigger>
        </TabsList>

        <TabsContent value="fluxos" className="mt-4">
          <div className="grid gap-6 lg:grid-cols-5">
            <Panel title="Fluxos de automação" subtitle="Receita atribuída por sequência" className="lg:col-span-3">
              {loadingAuto ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-muted/40" />)}
                </div>
              ) : automations.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  Nenhum fluxo configurado. Conecte WhatsApp (Meta) para ativar automações padrão.
                </div>
              ) : (
                <div className="space-y-3">
                  {automations.map((a) => {
                    const Icon = CHANNEL_ICON[a.channel] ?? Mail
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
                        {(a.recoveredCents ?? 0) > 0 && (
                          <div className="hidden text-right md:block">
                            <p className="font-mono text-sm text-success">{formatBRL(a.recoveredCents! / 100)}</p>
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">recuperado</p>
                          </div>
                        )}
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

            <Panel title="Últimos disparos" subtitle="Status de entrega" className="lg:col-span-2">
              {!stats?.recentDeliveries?.length ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Nenhum disparo registrado ainda.</p>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {stats.recentDeliveries.map((d) => (
                    <div key={d.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-xs">
                      <span className="capitalize text-muted-foreground">{d.channel}</span>
                      <StatusPill
                        label={d.status}
                        tone={d.status === 'failed' ? 'danger' : d.status === 'opened' ? 'success' : 'primary'}
                      />
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {new Date(d.sentAt).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </div>
        </TabsContent>

        <TabsContent value="rfm" className="mt-4">
          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title="Segmentação RFM" subtitle="Recência · Frequência · Valor">
              {loadingStats ? (
                <div className="grid grid-cols-2 gap-3">
                  {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-muted/40" />)}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {stats?.rfm.map((s) => (
                    <div key={s.label} className="rounded-xl border border-border bg-muted/20 p-4">
                      <StatusPill label={s.label} tone={s.tone} />
                      <p className="mt-3 font-mono text-xl font-semibold text-foreground">{formatNumber(s.count)}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">{s.desc}</p>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            <Panel title="Ciclo de vida" subtitle="Estágios da base">
              <div className="grid grid-cols-2 gap-3">
                {stats?.lifecycle.map((s) => (
                  <div key={s.stage} className="rounded-xl border border-border bg-muted/20 p-4">
                    <p className="text-xs text-muted-foreground">{s.stage}</p>
                    <p className="mt-2 font-mono text-xl font-semibold">{formatNumber(s.count)}</p>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </TabsContent>

        <TabsContent value="metricas" className="mt-4">
          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title="LTV por segmento RFM">
              <div className="space-y-2">
                {ltvAnalytics?.byRfm.map((r) => (
                  <div key={r.dimension} className="flex justify-between text-sm border-b border-border/50 pb-2">
                    <span>{r.label}</span>
                    <span className="font-mono">{formatBRL(r.avgLtv)} <span className="text-muted-foreground">({r.count})</span></span>
                  </div>
                ))}
              </div>
            </Panel>
            <Panel title="LTV por canal de origem">
              <div className="space-y-2">
                {ltvAnalytics?.byChannel.map((r) => (
                  <div key={r.dimension} className="flex justify-between text-sm border-b border-border/50 pb-2">
                    <span className="capitalize">{r.dimension}</span>
                    <span className="font-mono">{formatBRL(r.avgLtv)} <span className="text-muted-foreground">({r.count})</span></span>
                  </div>
                ))}
              </div>
            </Panel>
            <Panel title="Taxas por canal (30d)" className="lg:col-span-2">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {stats?.channelRates.map((c) => (
                  <div key={c.channel} className="rounded-xl border border-border p-4 text-center">
                    <p className="text-xs capitalize text-muted-foreground">{c.channel}</p>
                    <p className="mt-2 font-mono text-lg">
                      {c.sent > 0 ? Math.round((c.delivered / c.sent) * 100) : 0}%
                    </p>
                    <p className="text-[10px] text-muted-foreground">{c.delivered}/{c.sent} entregues</p>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </TabsContent>

        <TabsContent value="editor" className="mt-4 space-y-4">
          <Panel title="Editor visual de fluxos" subtitle="Arraste e solte — salva em automation_sequences">
            <FlowEditor trigger="carrinho_abandonado" name="Carrinho abandonado" />
          </Panel>
          {templates.length > 0 && (
            <Panel title="Biblioteca de templates" subtitle="Por vertical">
              <div className="grid gap-3 sm:grid-cols-2">
                {templates.map((t) => (
                  <div key={t.id} className="rounded-xl border border-border p-3 text-sm">
                    <div className="flex items-center gap-2">
                      <StatusPill label={t.vertical} tone="primary" />
                      <span className="text-muted-foreground">{t.channel}</span>
                    </div>
                    <p className="mt-2 font-medium">{t.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{t.body_preview}</p>
                  </div>
                ))}
              </div>
            </Panel>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
