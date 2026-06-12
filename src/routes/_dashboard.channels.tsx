import { createFileRoute, Link } from '@tanstack/react-router'
import { BarChart3, Store } from 'lucide-react'
import { PageIntro, Panel } from '@/components/dashboard/panel'
import { StatusPill } from '@/components/dashboard/status-pill'
import { formatBRL, formatNumber } from '@/lib/format'
import {
  useChannelAnalytics,
  useIntegrationHealth,
  useMarketplaceProfitability,
} from '@/modules/marketplaces/hooks/use-marketplaces'

export const Route = createFileRoute('/_dashboard/channels')({
  head: () => ({ meta: [{ title: 'Canais — Orbia' }] }),
  component: ChannelsDashboardPage,
})

const HEALTH_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  healthy: 'success',
  degraded: 'warning',
  down: 'danger',
  unknown: 'neutral',
};

function ChannelsDashboardPage() {
  const { data: channels = [], isLoading } = useChannelAnalytics(30)
  const { data: health = [] } = useIntegrationHealth()
  const { data: profitability = [] } = useMarketplaceProfitability()

  const totalGmv = channels.reduce((s, c) => s + c.gmvCents, 0)
  const totalOrders = channels.reduce((s, c) => s + c.orderCount, 0)

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Marketplaces"
        title="Performance por canal"
        description="GMV, ticket médio, SLA e saúde das integrações em uma visão unificada."
        action={
          <Link
            to="/catalog"
            className="text-sm text-primary hover:underline"
          >
            Gerenciar catálogo →
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Panel title="GMV 30d" action={<BarChart3 className="size-4 text-muted-foreground" />}>
          <p className="font-mono text-2xl font-semibold text-glow">
            {isLoading ? '—' : formatBRL(totalGmv / 100)}
          </p>
        </Panel>
        <Panel title="Pedidos 30d">
          <p className="font-mono text-2xl font-semibold">{isLoading ? '—' : formatNumber(totalOrders)}</p>
        </Panel>
        <Panel title="Canais ativos">
          <p className="font-mono text-2xl font-semibold">{channels.length}</p>
        </Panel>
        <Panel title="Integrações saudáveis">
          <p className="font-mono text-2xl font-semibold">
            {health.filter((h) => h.status === 'healthy').length}/{health.length || '—'}
          </p>
        </Panel>
      </div>

      <Panel title="Saúde das integrações" action={<Store className="size-4 text-muted-foreground" />}>
        {health.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma conexão OAuth registrada.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {health.map((h) => (
              <StatusPill
                key={h.provider}
                label={`${h.provider} · ${h.status}`}
                tone={HEALTH_TONE[h.status] ?? 'neutral'}
              />
            ))}
          </div>
        )}
      </Panel>

      <Panel title="Comparativo por canal">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-2 pr-4">Canal</th>
                  <th className="py-2 pr-4 font-mono">Pedidos</th>
                  <th className="py-2 pr-4 font-mono">GMV</th>
                  <th className="py-2 pr-4 font-mono">Ticket</th>
                  <th className="py-2 pr-4 font-mono">Cancel.</th>
                  <th className="py-2 pr-4 font-mono">SLA</th>
                  <th className="py-2 font-mono">Δ GMV</th>
                </tr>
              </thead>
              <tbody>
                {channels.map((row) => {
                  const profit = profitability.find((p) => p.channel === row.channel)
                  return (
                    <tr key={row.channel} className="border-b border-border/50">
                      <td className="py-2 pr-4 font-medium">{row.label}</td>
                      <td className="py-2 pr-4 font-mono">{row.orderCount}</td>
                      <td className="py-2 pr-4 font-mono">{formatBRL(row.gmvCents / 100, true)}</td>
                      <td className="py-2 pr-4 font-mono">{formatBRL(row.averageTicketCents / 100, true)}</td>
                      <td className="py-2 pr-4 font-mono">{row.cancelRatePercent}%</td>
                      <td className="py-2 pr-4 font-mono">{row.slaCompliancePercent}%</td>
                      <td className="py-2 font-mono">
                        {row.gmvDeltaPercent > 0 ? '+' : ''}
                        {row.gmvDeltaPercent}%
                        {profit && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            margem {profit.marginPercent}%
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  )
}
