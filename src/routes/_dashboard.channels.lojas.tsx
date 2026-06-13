import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { CreditCard, Gift, Globe } from 'lucide-react'
import { PageIntro, Panel } from '@/components/dashboard/panel'
import { StatusPill } from '@/components/dashboard/status-pill'
import { formatBRL } from '@/lib/format'
import { useStorefrontMetrics, useIntegrationHealth } from '@/modules/marketplaces/hooks/use-marketplaces'
import {
  ChannelSubNav,
  ChannelOAuthBanner,
} from '@/modules/marketplaces/components/channel-sub-nav'

export const Route = createFileRoute('/_dashboard/channels/lojas')({
  head: () => ({ meta: [{ title: 'Lojas próprias — Canais' }] }),
  component: LojasPage,
})

type StoreChannel = 'nuvemshop' | 'shopify'

function LojasPage() {
  const [channel, setChannel] = useState<StoreChannel>('nuvemshop')
  const { data: health = [] } = useIntegrationHealth()
  const { data, isLoading } = useStorefrontMetrics(channel)

  const gateways = data?.gateways ?? []
  const traffic = data?.traffic ?? []
  const giftCards = data?.giftCards ?? []

  const connHealth = health.find((h) => h.provider === channel)
  const isDisconnected = !connHealth || connHealth.status === 'down'

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Lojas próprias"
        title="Nuvemshop e Shopify"
        description="Gateways de pagamento, origem de tráfego UTM e gift cards (Shopify)."
      />
      <ChannelSubNav />

      <div className="flex gap-2">
        {(['nuvemshop', 'shopify'] as const).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setChannel(c)}
            className={`rounded-full border px-4 py-1.5 text-xs font-medium transition-colors ${
              channel === c
                ? 'border-primary/40 bg-primary/10 text-primary'
                : 'border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            {c === 'nuvemshop' ? 'Nuvemshop' : 'Shopify'}
          </button>
        ))}
      </div>

      {isDisconnected && (
        <ChannelOAuthBanner provider={channel} label={channel === 'nuvemshop' ? 'Nuvemshop' : 'Shopify'} />
      )}

      <StatusPill
        label="Sync bidirecional: parcial — push de catálogo ainda em desenvolvimento"
        tone="warning"
        dot
      />

      <Panel
        title="Gateways de pagamento"
        action={<CreditCard className="size-4 text-muted-foreground" />}
      >
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : gateways.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum gateway configurado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-2 pr-4">Gateway</th>
                  <th className="py-2 pr-4">Provedor</th>
                  <th className="py-2 pr-4 font-mono">Taxa %</th>
                  <th className="py-2 font-mono">Liquidação (dias)</th>
                </tr>
              </thead>
              <tbody>
                {gateways.map((g) => (
                  <tr key={g.gateway} className="border-b border-border/50">
                    <td className="py-2 pr-4 font-medium">{g.gateway}</td>
                    <td className="py-2 pr-4">{g.provider}</td>
                    <td className="py-2 pr-4 font-mono">
                      {g.feeRatePercent != null ? `${g.feeRatePercent}%` : '—'}
                    </td>
                    <td className="py-2 font-mono">{g.settlementDays ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Origem de tráfego (UTM)" action={<Globe className="size-4 text-muted-foreground" />}>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : traffic.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem dados de UTM no período.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-2 pr-4">Source</th>
                  <th className="py-2 pr-4">Medium</th>
                  <th className="py-2 pr-4 font-mono">Sessões</th>
                  <th className="py-2 pr-4 font-mono">Pedidos</th>
                  <th className="py-2 font-mono">GMV</th>
                </tr>
              </thead>
              <tbody>
                {traffic.map((t) => (
                  <tr key={`${t.source}-${t.medium}`} className="border-b border-border/50">
                    <td className="py-2 pr-4">{t.source}</td>
                    <td className="py-2 pr-4">{t.medium}</td>
                    <td className="py-2 pr-4 font-mono">{t.sessions}</td>
                    <td className="py-2 pr-4 font-mono">{t.orders}</td>
                    <td className="py-2 font-mono">{formatBRL(t.revenueCents / 100, true)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {channel === 'shopify' && (
        <Panel title="Gift cards" action={<Gift className="size-4 text-muted-foreground" />}>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : giftCards.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum gift card ativo.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="py-2 pr-4">Código</th>
                    <th className="py-2 pr-4 font-mono">Saldo</th>
                    <th className="py-2 pr-4 font-mono">Valor inicial</th>
                    <th className="py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {giftCards.map((gc) => (
                    <tr key={gc.id} className="border-b border-border/50">
                      <td className="py-2 pr-4 font-mono text-xs">{gc.code}</td>
                      <td className="py-2 pr-4 font-mono">{formatBRL(gc.balanceCents / 100)}</td>
                      <td className="py-2 pr-4 font-mono">{formatBRL(gc.initialValueCents / 100)}</td>
                      <td className="py-2">
                        <StatusPill
                          label={gc.disabled ? 'Desativado' : 'Ativo'}
                          tone={gc.disabled ? 'neutral' : 'success'}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}
    </div>
  )
}
