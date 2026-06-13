import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { BarChart3, Download, RefreshCw, Store } from 'lucide-react'
import { PageIntro, Panel } from '@/components/dashboard/panel'
import { StatusPill } from '@/components/dashboard/status-pill'
import { Button } from '@/components/ui/button'
import { formatBRL, formatNumber } from '@/lib/format'
import {
  useChannelAnalytics,
  useIntegrationHealth,
  useMarketplaceProfitability,
  useMarketplaceProductProfitability,
  useRunMarketplaceAdvancedSync,
} from '@/modules/marketplaces/hooks/use-marketplaces'
import { exportChannelsCsv } from '@/modules/marketplaces/actions.functions'
import {
  ChannelSubNav,
  CHANNEL_ADVANCED_ROUTES,
} from '@/modules/marketplaces/components/channel-sub-nav'

export const Route = createFileRoute('/_dashboard/channels')({
  head: () => ({ meta: [{ title: 'Canais — Orbia' }] }),
  component: ChannelsDashboardPage,
})

const HEALTH_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  healthy: 'success',
  degraded: 'warning',
  down: 'danger',
  unknown: 'neutral',
}

const CHANNEL_OPTIONS = [
  { value: 'mercado_livre', label: 'Mercado Livre' },
  { value: 'shopee', label: 'Shopee' },
  { value: 'amazon', label: 'Amazon' },
  { value: 'tiktok', label: 'TikTok Shop' },
  { value: 'nuvemshop', label: 'Nuvemshop' },
  { value: 'shopify', label: 'Shopify' },
  { value: 'instagram', label: 'Instagram' },
]

function ChannelsDashboardPage() {
  const [profitChannel, setProfitChannel] = useState('mercado_livre')
  const { data: channels = [], isLoading } = useChannelAnalytics(30)
  const { data: health = [] } = useIntegrationHealth()
  const { data: profitability = [] } = useMarketplaceProfitability()
  const { data: productProfit = [], isLoading: loadingProducts } =
    useMarketplaceProductProfitability(profitChannel, 30)
  const advancedSync = useRunMarketplaceAdvancedSync()

  const totalGmv = channels.reduce((s, c) => s + c.gmvCents, 0)
  const totalOrders = channels.reduce((s, c) => s + c.orderCount, 0)

  const handleExportCsv = async () => {
    const { csv, filename } = await exportChannelsCsv({ data: { days: 30 } })
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Marketplaces"
        title="Performance por canal"
        description="GMV, ticket médio, SLA e saúde das integrações em uma visão unificada."
        action={
          <div className="flex shrink-0 items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={advancedSync.isPending}
              onClick={() => advancedSync.mutate()}
            >
              <RefreshCw className={`mr-2 size-4 ${advancedSync.isPending ? 'animate-spin' : ''}`} />
              Sincronizar avançado
            </Button>
            <Button size="sm" variant="outline" onClick={() => void handleExportCsv()}>
              <Download className="mr-2 size-4" />
              Exportar CSV
            </Button>
            <Link to="/catalog" className="text-sm text-primary hover:underline">
              Gerenciar catálogo →
            </Link>
          </div>
        }
      />

      <ChannelSubNav />

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

      {channels.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {channels.map((row) => {
            const advancedRoute = CHANNEL_ADVANCED_ROUTES[row.channel]
            const card = (
              <div className="surface-elevated p-4 transition-colors hover:border-border-strong">
                <p className="text-sm font-medium">{row.label}</p>
                <p className="mt-1 font-mono text-lg font-semibold">
                  {formatBRL(row.gmvCents / 100, true)}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {row.orderCount} pedidos · SLA {row.slaCompliancePercent}%
                </p>
              </div>
            )
            return advancedRoute ? (
              <Link key={row.channel} to={advancedRoute} className="block">
                {card}
              </Link>
            ) : (
              <div key={row.channel}>{card}</div>
            )
          })}
        </div>
      )}

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
                  const advancedRoute = CHANNEL_ADVANCED_ROUTES[row.channel]
                  return (
                    <tr key={row.channel} className="border-b border-border/50">
                      <td className="py-2 pr-4 font-medium">
                        {advancedRoute ? (
                          <Link to={advancedRoute} className="text-primary hover:underline">
                            {row.label}
                          </Link>
                        ) : (
                          row.label
                        )}
                      </td>
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

      <Panel
        title="Rentabilidade por produto"
        subtitle="Margem estimada por SKU no canal selecionado (30 dias)"
        action={
          <select
            value={profitChannel}
            onChange={(e) => setProfitChannel(e.target.value)}
            className="rounded-md border border-border bg-background px-2 py-1 text-xs"
          >
            {CHANNEL_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        }
      >
        {loadingProducts ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : productProfit.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum produto com vendas neste canal.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-2 pr-4">SKU</th>
                  <th className="py-2 pr-4">Produto</th>
                  <th className="py-2 pr-4 font-mono">Unidades</th>
                  <th className="py-2 pr-4 font-mono">GMV</th>
                  <th className="py-2 pr-4 font-mono">Taxas</th>
                  <th className="py-2 font-mono">Líquido</th>
                </tr>
              </thead>
              <tbody>
                {productProfit.map((row) => (
                  <tr key={row.sku} className="border-b border-border/50">
                    <td className="py-2 pr-4 font-mono text-xs">{row.sku}</td>
                    <td className="py-2 pr-4">{row.name}</td>
                    <td className="py-2 pr-4 font-mono">{row.unitsSold}</td>
                    <td className="py-2 pr-4 font-mono">{formatBRL(row.gmvCents / 100, true)}</td>
                    <td className="py-2 pr-4 font-mono">{formatBRL(row.feeCents / 100, true)}</td>
                    <td className="py-2 font-mono">{formatBRL(row.netRevenueCents / 100, true)}</td>
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
