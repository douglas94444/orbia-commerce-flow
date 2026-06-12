import { useEffect, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Mail, Repeat, TrendingUp, Users, ExternalLink } from 'lucide-react'
import { PageIntro, Panel } from '@/components/dashboard/panel'
import { KpiCard } from '@/components/dashboard/kpi-card'
import { StatusPill } from '@/components/dashboard/status-pill'
import {
  RFMBadge,
  ChannelIcon,
  FunnelBar,
  QuickWinBanner,
  OpportunityCard,
} from '@/shared/components'
import { formatBRL, formatNumber } from '@/lib/format'
import {
  useAutomations,
  useRetentionStats,
  useToggleAutomation,
  useLtvAnalytics,
  useTemplateLibrary,
  useSimulateAutomation,
  useApplyTemplate,
  useCohortRetention,
  useMessageDeliveryLog,
  useLoyaltySummary,
  useRedeemLoyalty,
  useAbExperiments,
  useCreateAbExperiment,
  useUpdateQuietHours,
  useSyncWhatsAppTemplates,
  useUpdateWhatsAppProvider,
  useQuietHours,
  useAutomationSteps,
  useBackfillContacts,
} from '@/modules/retention/hooks/use-retention'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FlowEditor } from '@/modules/retention/flow-editor/flow-editor'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export const Route = createFileRoute('/_dashboard/retention')({
  head: () => ({ meta: [{ title: 'Retenção — Orbia' }] }),
  component: RetentionPage,
})

function RetentionPage() {
  const { data: automations = [], isLoading: loadingAuto } = useAutomations()
  const { data: stats, isLoading: loadingStats } = useRetentionStats()
  const { data: ltvAnalytics } = useLtvAnalytics()
  const { data: templates = [] } = useTemplateLibrary()
  const { data: cohorts = [] } = useCohortRetention()
  const { data: loyalty } = useLoyaltySummary()
  const { data: abExperiments = [] } = useAbExperiments()
  const { mutate: toggle, isPending: toggling } = useToggleAutomation()
  const { mutate: simulate, isPending: simulating, data: simulation } = useSimulateAutomation()
  const { mutate: applyTemplate, isPending: applyingTpl } = useApplyTemplate()
  const { mutate: redeem, isPending: redeeming } = useRedeemLoyalty()
  const { mutate: saveQuietHours, isPending: savingHours } = useUpdateQuietHours()
  const { mutate: syncWaTemplates, isPending: syncingWa } = useSyncWhatsAppTemplates()
  const { mutate: setWaProvider } = useUpdateWhatsAppProvider()
  const { mutate: createAb, isPending: creatingAb } = useCreateAbExperiment()
  const { data: quietHours } = useQuietHours()
  const { data: automationSteps = [] } = useAutomationSteps()
  const { mutate: backfillContacts, isPending: backfilling } = useBackfillContacts()

  const [logChannel, setLogChannel] = useState<string>('')
  const [logStatus, setLogStatus] = useState<string>('')
  const { data: messageLog = [] } = useMessageDeliveryLog({
    channel: logChannel || undefined,
    status: logStatus || undefined,
  })

  const [editSequenceId, setEditSequenceId] = useState<string | undefined>()
  const [quietStart, setQuietStart] = useState(22)
  const [quietEnd, setQuietEnd] = useState(8)
  const [redeemCustomerId, setRedeemCustomerId] = useState('')
  const [redeemPoints, setRedeemPoints] = useState(500)
  const [abStepId, setAbStepId] = useState('')
  const [abVariantA, setAbVariantA] = useState('')
  const [abVariantB, setAbVariantB] = useState('')

  useEffect(() => {
    if (quietHours) {
      setQuietStart(quietHours.quietHoursStart)
      setQuietEnd(quietHours.quietHoursEnd)
    }
  }, [quietHours])

  const loading = loadingAuto || loadingStats
  const atRiskCount = stats?.rfm.find((s) => s.segment === 'em_risco')?.count ?? 0
  const lifecycleMax = Math.max(stats?.customerCount ?? 0, ...(stats?.lifecycle.map((s) => s.count) ?? [0]), 1)

  return (
    <div className="space-y-6">
      <QuickWinBanner count={atRiskCount} />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageIntro
          eyebrow="Módulo Retenção"
          title="LTV Boost — Automações & WhatsApp"
          description="Fluxos multi-canal com Meta/Evolution WhatsApp, segmentação RFM, fidelidade e métricas por automação."
        />
        <div className="flex flex-wrap gap-2 shrink-0">
          <Button size="sm" variant="outline" disabled={syncingWa} onClick={() => syncWaTemplates()}>
            Sync templates Meta
          </Button>
          <Button size="sm" variant="outline" onClick={() => setWaProvider('evolution')}>
            Usar Evolution
          </Button>
          <Button size="sm" variant="outline" onClick={() => setWaProvider('meta')}>
            Usar Meta API
          </Button>
          <Button size="sm" variant="outline" disabled={backfilling} onClick={() => backfillContacts()}>
            Backfill contatos
          </Button>
          <Link
            to="/portal/settings"
            className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
          >
            Configurar WhatsApp <ExternalLink className="size-3" />
          </Link>
        </div>
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
          <TabsTrigger value="fidelidade">Fidelidade</TabsTrigger>
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
                  {automations.map((a) => (
                      <div key={a.id} className="flex items-center gap-4 rounded-xl border border-border bg-muted/20 p-4">
                        <span className="icon-well size-10 shrink-0">
                          <ChannelIcon channel={a.channel} className="size-5" />
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
                        <Button size="sm" variant="ghost" onClick={() => setEditSequenceId(a.id)}>
                          Editar
                        </Button>
                        <button
                          onClick={() => toggle({ id: a.id, active: !a.active })}
                          disabled={toggling}
                          title={a.active ? 'Pausar' : 'Ativar'}
                        >
                          <StatusPill label={a.active ? 'Ativo' : 'Pausado'} tone={a.active ? 'success' : 'neutral'} dot />
                        </button>
                      </div>
                  ))}
                </div>
              )}
            </Panel>

            <div className="lg:col-span-2 space-y-6">
              <Panel title="Quiet hours" subtitle="Horário silencioso para todos os fluxos">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Início (h)</Label>
                    <Input type="number" min={0} max={23} value={quietStart} onChange={(e) => setQuietStart(Number(e.target.value))} className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs">Fim (h)</Label>
                    <Input type="number" min={0} max={23} value={quietEnd} onChange={(e) => setQuietEnd(Number(e.target.value))} className="mt-1" />
                  </div>
                </div>
                <Button
                  size="sm"
                  className="mt-3"
                  disabled={savingHours}
                  onClick={() => saveQuietHours({ quietHoursStart: quietStart, quietHoursEnd: quietEnd })}
                >
                  Salvar horários
                </Button>
              </Panel>

              <Panel title="Log de mensagens" subtitle="Filtros por canal e status">
                <div className="flex gap-2 mb-3">
                  <select value={logChannel} onChange={(e) => setLogChannel(e.target.value)} className="rounded-md border border-border bg-background px-2 py-1 text-xs">
                    <option value="">Todos canais</option>
                    <option value="email">Email</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="sms">SMS</option>
                    <option value="push">Push</option>
                  </select>
                  <select value={logStatus} onChange={(e) => setLogStatus(e.target.value)} className="rounded-md border border-border bg-background px-2 py-1 text-xs">
                    <option value="">Todos status</option>
                    <option value="sent">Enviado</option>
                    <option value="delivered">Entregue</option>
                    <option value="opened">Aberto</option>
                    <option value="clicked">Clique</option>
                    <option value="failed">Falhou</option>
                  </select>
                </div>
                {!messageLog.length ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">Nenhum registro.</p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {messageLog.map((d) => (
                      <div key={d.id} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-xs">
                        <span className="flex items-center gap-1.5 capitalize text-muted-foreground">
                          <ChannelIcon channel={d.channel} className="size-3.5" />
                          {d.channel}
                        </span>
                        <StatusPill
                          label={d.status}
                          tone={d.status === 'failed' ? 'danger' : d.status === 'opened' || d.status === 'clicked' ? 'success' : 'primary'}
                        />
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {new Date(d.sent_at).toLocaleString('pt-BR')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Panel>
            </div>
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
                    <div key={s.segment} className="rounded-xl border border-border bg-muted/20 p-4">
                      <RFMBadge segment={s.segment} label={s.label} />
                      <p className="text-metric mt-3 text-xl font-semibold text-foreground">{formatNumber(s.count)}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">{s.desc}</p>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            <Panel title="Ciclo de vida" subtitle="Funil da base de clientes">
              <div className="divide-y divide-border">
                {stats?.lifecycle.map((s, i, arr) => {
                  const prev = i > 0 ? arr[i - 1]!.count : lifecycleMax
                  const dropRate = i > 0 && prev > 0 ? 1 - s.count / prev : undefined
                  return (
                    <FunnelBar
                      key={s.stage}
                      label={s.stage}
                      value={s.count}
                      max={lifecycleMax}
                      dropRate={dropRate}
                      isBottleneck={s.stage === 'Em risco' || s.stage === 'Frios'}
                    />
                  )
                })}
              </div>
              {atRiskCount > 0 && (
                <div className="mt-4">
                  <OpportunityCard
                    title={`${formatNumber(atRiskCount)} clientes em risco de churn`}
                    potential={formatBRL((stats?.avgLtv ?? 0) * atRiskCount, true)}
                    ctaLabel="Criar fluxo"
                  />
                </div>
              )}
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
            <Panel title="Retenção por cohort" subtitle="Compradores ativos por mês desde 1ª compra" className="lg:col-span-2">
              {!cohorts.length ? (
                <p className="text-sm text-muted-foreground py-4">Dados insuficientes para cohort.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-muted-foreground text-xs">
                        <th className="pb-2">Cohort</th>
                        <th className="pb-2">M0</th>
                        <th className="pb-2">M1</th>
                        <th className="pb-2">M2</th>
                        <th className="pb-2">M3</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cohorts.map((row) => (
                        <tr key={row.cohort} className="border-t border-border/50">
                          <td className="py-2">{row.cohort}</td>
                          <td className="font-mono py-2">{row.month0}%</td>
                          <td className="font-mono py-2">{row.month1}%</td>
                          <td className="font-mono py-2">{row.month2}%</td>
                          <td className="font-mono py-2">{row.month3}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
            <Panel title="Taxas por canal (30d)" className="lg:col-span-2">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {stats?.channelRates.map((c) => (
                  <div key={c.channel} className="rounded-xl border border-border p-4 text-center">
                    <div className="flex items-center justify-center gap-1.5 text-xs capitalize text-muted-foreground">
                      <ChannelIcon channel={c.channel} className="size-3.5" />
                      {c.channel}
                    </div>
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

        <TabsContent value="fidelidade" className="mt-4">
          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title="Programa de fidelidade" subtitle={`${loyalty?.accountCount ?? 0} contas · ${formatNumber(loyalty?.totalPoints ?? 0)} pts totais`}>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {(loyalty?.accounts ?? []).map((a) => (
                  <div key={a.id} className="flex justify-between items-center border-b border-border/50 pb-2 text-sm">
                    <span className="font-mono text-xs text-muted-foreground">{a.customer_id.slice(0, 8)}…</span>
                    <StatusPill label={a.tier} tone="primary" />
                    <span className="font-mono">{formatNumber(a.points_balance)} pts</span>
                  </div>
                ))}
              </div>
            </Panel>
            <Panel title="Resgate de pontos" subtitle="Gera cupom e dispara via WhatsApp">
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">Customer ID</Label>
                  <Input value={redeemCustomerId} onChange={(e) => setRedeemCustomerId(e.target.value)} className="mt-1 font-mono text-xs" placeholder="uuid do cliente" />
                </div>
                <div>
                  <Label className="text-xs">Pontos</Label>
                  <Input type="number" min={100} value={redeemPoints} onChange={(e) => setRedeemPoints(Number(e.target.value))} className="mt-1" />
                </div>
                <Button
                  disabled={redeeming || !redeemCustomerId}
                  onClick={() => redeem({ customerId: redeemCustomerId, points: redeemPoints })}
                >
                  Resgatar pontos
                </Button>
              </div>
            </Panel>
          </div>
        </TabsContent>

        <TabsContent value="editor" className="mt-4 space-y-4">
          <Panel title="Simulador de fluxo" subtitle="Estimativa com benchmarks Orbia">
            <div className="flex flex-wrap gap-2">
              {['carrinho_abandonado', 'reativacao_30d', 'pedido_entregue'].map((tr) => (
                <Button
                  key={tr}
                  size="sm"
                  variant="outline"
                  disabled={simulating}
                  onClick={() => simulate(tr)}
                >
                  Simular {tr.replace(/_/g, ' ')}
                </Button>
              ))}
            </div>
            {simulation && (
              <div className="mt-4 grid grid-cols-3 gap-4 rounded-xl border border-border bg-muted/20 p-4">
                <div>
                  <p className="text-xs text-muted-foreground">Clientes impactados</p>
                  <p className="font-mono text-xl">{formatNumber(simulation.impactedCustomers)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Taxa conversão esperada</p>
                  <p className="font-mono text-xl">{(simulation.expectedConversionRate * 100).toFixed(1)}%</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Receita esperada</p>
                  <p className="font-mono text-xl">{formatBRL(simulation.expectedRevenueCents / 100)}</p>
                </div>
                <p className="col-span-3 text-[10px] text-muted-foreground">Fonte: {simulation.benchmarkSource}</p>
              </div>
            )}
          </Panel>

          <Panel title="Editor visual de fluxos" subtitle="Carregar, editar e salvar sequências">
            <FlowEditor
              sequenceId={editSequenceId}
              trigger="carrinho_abandonado"
              name="Carrinho abandonado"
              onSaved={(id) => setEditSequenceId(id)}
            />
          </Panel>

          <Panel title="Testes A/B" subtitle="Variantes por step de automação">
            <div className="grid gap-3 sm:grid-cols-3 mb-4">
              <select
                value={abStepId}
                onChange={(e) => setAbStepId(e.target.value)}
                className="rounded-md border border-border bg-background px-2 py-2 text-xs"
              >
                <option value="">Selecione o step</option>
                {automationSteps.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
              <Input placeholder="Variante A (template_key)" value={abVariantA} onChange={(e) => setAbVariantA(e.target.value)} />
              <Input placeholder="Variante B (template_key)" value={abVariantB} onChange={(e) => setAbVariantB(e.target.value)} />
            </div>
            <Button
              size="sm"
              disabled={creatingAb || !abStepId || !abVariantA || !abVariantB}
              onClick={() => createAb({ stepId: abStepId, variantAKey: abVariantA, variantBKey: abVariantB })}
            >
              Criar experimento
            </Button>
            {abExperiments.length > 0 && (
              <div className="mt-4 space-y-2">
                {abExperiments.map((e) => (
                  <div key={e.id} className="flex flex-wrap gap-3 text-xs border border-border rounded-lg p-3">
                    <span>{e.variant_a_key} vs {e.variant_b_key}</span>
                    <span className="font-mono">A: {e.sends_a} env / {e.conversions_a} conv</span>
                    <span className="font-mono">B: {e.sends_b} env / {e.conversions_b} conv</span>
                    {e.winner && <StatusPill label={`Vencedor: ${e.winner}`} tone="success" />}
                  </div>
                ))}
              </div>
            )}
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
                    <Button
                      size="sm"
                      variant="secondary"
                      className="mt-3"
                      disabled={applyingTpl}
                      onClick={() => applyTemplate({ templateId: t.id, sequenceName: t.name })}
                    >
                      Aplicar template
                    </Button>
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
