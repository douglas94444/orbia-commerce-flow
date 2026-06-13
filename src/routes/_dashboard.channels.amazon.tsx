import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { Box, HeartPulse, Package, Search } from 'lucide-react'
import { PageIntro, Panel } from '@/components/dashboard/panel'
import { KpiCard } from '@/components/dashboard/kpi-card'
import { StatusPill } from '@/components/dashboard/status-pill'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatBRL } from '@/lib/format'
import {
  useAmazonMetrics,
  useBuyBoxCheck,
  useIntegrationHealth,
} from '@/modules/marketplaces/hooks/use-marketplaces'
import {
  ChannelSubNav,
  ChannelOAuthBanner,
} from '@/modules/marketplaces/components/channel-sub-nav'

export const Route = createFileRoute('/_dashboard/channels/amazon')({
  head: () => ({ meta: [{ title: 'Amazon — Canais' }] }),
  component: AmazonPage,
})

const HEALTH_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  GOOD: 'success',
  AT_RISK: 'warning',
  CRITICAL: 'danger',
  UNKNOWN: 'neutral',
}

function AmazonPage() {
  const [asin, setAsin] = useState('')
  const { data: health = [] } = useIntegrationHealth()
  const { data, isLoading } = useAmazonMetrics()
  const buyBox = useBuyBoxCheck()

  const accountHealth = data?.health
  const inventory = data?.inventory ?? []

  const amazonHealth = health.find((h) => h.provider === 'amazon')
  const isDisconnected = !amazonHealth || amazonHealth.status === 'down'

  const handleBuyBoxCheck = () => {
    if (!asin.trim()) return
    buyBox.mutate(asin.trim())
  }

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Amazon"
        title="Account Health, FBA e Buy Box"
        description="Métricas de saúde da conta, inventário FBA e verificação de Buy Box por ASIN."
      />
      <ChannelSubNav />

      {isDisconnected && <ChannelOAuthBanner provider="amazon" label="Amazon" />}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="ODR"
          value={isLoading ? '—' : `${accountHealth?.orderDefectRate ?? 0}%`}
          icon={HeartPulse}
          accent={
            accountHealth && accountHealth.orderDefectRate > 1 ? 'warning' : 'success'
          }
        />
        <KpiCard
          label="Envio atrasado"
          value={isLoading ? '—' : `${accountHealth?.lateShipmentRate ?? 0}%`}
          icon={Package}
        />
        <KpiCard
          label="Cancelamento pré-envio"
          value={isLoading ? '—' : `${accountHealth?.preFulfillmentCancelRate ?? 0}%`}
          icon={Box}
        />
        <KpiCard
          label="Saúde conta"
          value={isLoading ? '—' : (accountHealth?.healthStatus ?? 'UNKNOWN')}
          icon={HeartPulse}
          accent={
            accountHealth?.healthStatus === 'GOOD'
              ? 'success'
              : accountHealth?.healthStatus === 'CRITICAL'
                ? 'warning'
                : 'primary'
          }
        />
      </div>

      {accountHealth && (
        <StatusPill
          label={`Status: ${accountHealth.healthStatus}`}
          tone={HEALTH_TONE[accountHealth.healthStatus] ?? 'neutral'}
          dot
        />
      )}

      <Panel
        title="Inventário FBA"
        subtitle="SKUs com estoque na rede Amazon"
        action={
          <Link to="/logistics" className="text-xs text-primary hover:underline">
            Fila unificada →
          </Link>
        }
      >
        <p className="mb-4 text-xs text-muted-foreground">
          Pedidos FBA e MFN aparecem na{' '}
          <Link to="/logistics" className="text-primary hover:underline">
            fila unificada de logística
          </Link>
          .
        </p>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : inventory.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum item FBA encontrado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-2 pr-4">SKU</th>
                  <th className="py-2 pr-4">ASIN</th>
                  <th className="py-2 pr-4 font-mono">Disponível</th>
                  <th className="py-2 pr-4 font-mono">Inbound</th>
                  <th className="py-2 font-mono">Reservado</th>
                </tr>
              </thead>
              <tbody>
                {inventory.map((row) => (
                  <tr key={row.sku} className="border-b border-border/50">
                    <td className="py-2 pr-4 font-mono text-xs">{row.sku}</td>
                    <td className="py-2 pr-4 font-mono text-xs">{row.asin}</td>
                    <td className="py-2 pr-4 font-mono">{row.fulfillableQty}</td>
                    <td className="py-2 pr-4 font-mono">{row.inboundQty}</td>
                    <td className="py-2 font-mono">{row.reservedQty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Buy Box" subtitle="Verifique se você está ganhando o Buy Box para um ASIN">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <label className="mb-1 block text-xs text-muted-foreground">ASIN</label>
            <Input
              placeholder="B0XXXXXXXX"
              value={asin}
              onChange={(e) => setAsin(e.target.value.toUpperCase())}
            />
          </div>
          <Button
            onClick={handleBuyBoxCheck}
            disabled={buyBox.isPending || !asin.trim()}
          >
            <Search className="mr-2 size-4" />
            Verificar
          </Button>
        </div>

        {buyBox.data && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <StatusPill
              label={buyBox.data.isBuyBoxWinner ? 'Buy Box ganho' : 'Buy Box perdido'}
              tone={buyBox.data.isBuyBoxWinner ? 'success' : 'danger'}
              dot
            />
            {buyBox.data.priceCents != null && (
              <span className="text-sm text-muted-foreground">
                Seu preço: <span className="font-mono">{formatBRL(buyBox.data.priceCents / 100)}</span>
              </span>
            )}
            {buyBox.data.sellerId && (
              <span className="text-xs text-muted-foreground">Seller: {buyBox.data.sellerId}</span>
            )}
          </div>
        )}
      </Panel>
    </div>
  )
}
