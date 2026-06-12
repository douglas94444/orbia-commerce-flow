import { createFileRoute } from '@tanstack/react-router'
import { Gauge, RefreshCw, Target, TrendingUp, Wallet } from 'lucide-react'
import { PageIntro, Panel } from '@/components/dashboard/panel'
import { KpiCard } from '@/components/dashboard/kpi-card'
import { ChannelRoasChart } from '@/components/dashboard/charts'
import { StatusPill } from '@/components/dashboard/status-pill'
import { Button } from '@/components/ui/button'
import { formatBRL } from '@/lib/format'
import { useCampaigns, useTrafficStats, useSyncMetaCampaigns, useSyncGoogleCampaigns } from '@/modules/traffic/hooks/use-traffic'

export const Route = createFileRoute('/_dashboard/traffic')({
  head: () => ({ meta: [{ title: 'Tráfego — Orbia' }] }),
  component: TrafficPage,
})

const CAMPAIGN_TONE = { ativa: 'success', atencao: 'warning', pausada: 'neutral' } as const
const CAMPAIGN_LABEL = { ativa: 'Ativa', atencao: 'Atenção', pausada: 'Pausada' } as const

function TrafficPage() {
  const { data: campaigns = [], isLoading: loadingCampaigns } = useCampaigns()
  const { data: stats,          isLoading: loadingStats     } = useTrafficStats()
  const syncMeta = useSyncMetaCampaigns()
  const syncGoogle = useSyncGoogleCampaigns()

  const loading = loadingCampaigns || loadingStats

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Módulo Tráfego"
        title="Performance de mídia paga"
        description="ROAS por canal com atribuição multicanal e alertas automáticos quando o retorno cai abaixo do threshold."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label="ROAS médio"
          value={loading ? '—' : stats && stats.avgRoas > 0 ? `${stats.avgRoas.toFixed(1)}x` : '—'}
          icon={Gauge}
          accent="primary"
        />
        <KpiCard
          label="Investimento (30d)"
          value={loading ? '—' : stats && stats.totalSpend > 0 ? formatBRL(stats.totalSpend, true) : '—'}
          icon={Wallet}
          accent="accent"
        />
        <KpiCard
          label="Receita plataforma"
          value={loading ? '—' : stats && stats.totalRevenue > 0 ? formatBRL(stats.totalRevenue, true) : '—'}
          hint="Pixel Meta/Google"
          icon={TrendingUp}
          accent="success"
        />
        <KpiCard
          label="Receita pedidos"
          value={
            loading
              ? '—'
              : stats && stats.totalAttributedRevenue > 0
                ? formatBRL(stats.totalAttributedRevenue, true)
                : '—'
          }
          hint={`ROAS pedidos ${stats?.avgAttributedRoas?.toFixed(1) ?? '—'}x`}
          icon={Target}
          accent="primary"
        />
      </div>

      <Panel title="ROAS por canal" subtitle="Meta, Google, TikTok e orgânico">
        <ChannelRoasChart />
      </Panel>

      <Panel
        title="Campanhas em execução"
        subtitle="Diagnóstico assistido por IA"
        action={
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs"
              disabled={syncMeta.isPending}
              onClick={() => syncMeta.mutate()}
            >
              <RefreshCw className={`size-3.5 ${syncMeta.isPending ? 'animate-spin' : ''}`} />
              Sincronizar Meta
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs"
              disabled={syncGoogle.isPending}
              onClick={() => syncGoogle.mutate()}
            >
              <RefreshCw className={`size-3.5 ${syncGoogle.isPending ? 'animate-spin' : ''}`} />
              Sincronizar Google
            </Button>
          </div>
        }
      >
        {loadingCampaigns ? (
          <div className="space-y-3 py-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-muted/40" />
            ))}
          </div>
        ) : campaigns.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Nenhuma campanha encontrada. Conecte sua conta Meta Ads ou Google Ads para começar.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-left">
                  {['Campanha','Plataforma','Investido','Rec. plataforma','Rec. pedidos','ROAS','Status'].map((h, i) => (
                    <th key={h} className={`pb-3 text-[10px] font-medium uppercase tracking-wider text-muted-foreground${i >= 2 && i <= 5 ? ' text-right' : ''}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {campaigns.map((c) => (
                  <tr key={c.id} className="transition-colors hover:bg-muted/30">
                    <td className="py-3">
                      <p className="text-sm font-medium text-foreground">{c.name}</p>
                      <p className="text-[11px] text-muted-foreground">{c.client}</p>
                    </td>
                    <td className="py-3 text-sm text-muted-foreground">{c.platform}</td>
                    <td className="py-3 text-right font-mono text-sm text-foreground">{formatBRL(c.spend, true)}</td>
                    <td className="py-3 text-right font-mono text-sm text-foreground">{formatBRL(c.revenue, true)}</td>
                    <td className="py-3 text-right font-mono text-sm text-foreground">
                      <span>{formatBRL(c.attributedRevenue, true)}</span>
                      {c.revenueDivergencePct > 20 && (
                        <span className="ml-1 text-[10px] text-warning">±{c.revenueDivergencePct}%</span>
                      )}
                    </td>
                    <td
                      className="py-3 text-right font-mono text-sm font-semibold"
                      style={{ color: c.attributedRoas < 4 ? 'var(--destructive)' : c.attributedRoas < 6 ? 'var(--warning)' : 'var(--success)' }}
                      title={`Plataforma: ${c.roas.toFixed(1)}x`}
                    >
                      {c.attributedRoas.toFixed(1)}x
                    </td>
                    <td className="py-3">
                      <StatusPill label={CAMPAIGN_LABEL[c.status]} tone={CAMPAIGN_TONE[c.status]} dot />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  )
}
