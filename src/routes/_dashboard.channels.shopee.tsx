import { createFileRoute, Link } from '@tanstack/react-router'
import { AlertTriangle, Clock, Percent, Star } from 'lucide-react'
import { PageIntro, Panel } from '@/components/dashboard/panel'
import { KpiCard } from '@/components/dashboard/kpi-card'
import { StatusPill } from '@/components/dashboard/status-pill'
import { useShopeeMetrics, useIntegrationHealth } from '@/modules/marketplaces/hooks/use-marketplaces'
import {
  ChannelSubNav,
  ChannelOAuthBanner,
} from '@/modules/marketplaces/components/channel-sub-nav'

export const Route = createFileRoute('/_dashboard/channels/shopee')({
  head: () => ({ meta: [{ title: 'Shopee — Canais' }] }),
  component: ShopeePage,
})

function ShopeePage() {
  const { data: health = [] } = useIntegrationHealth()
  const { data, isLoading } = useShopeeMetrics()
  const score = data?.score
  const penalties = data?.penalties
  const promotions = data?.promotions ?? []

  const shopeeHealth = health.find((h) => h.provider === 'shopee')
  const isDisconnected = !shopeeHealth || shopeeHealth.status === 'down'

  const scoreCategories = score
    ? [
        { label: 'Fulfillment', value: score.fulfillment },
        { label: 'Atendimento', value: score.customerService },
        { label: 'Listagens', value: score.listing },
      ]
    : []

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Shopee"
        title="Score, penalidades e promoções"
        description="Performance da loja Shopee e campanhas promocionais ativas."
      />
      <ChannelSubNav />

      {isDisconnected && <ChannelOAuthBanner provider="shopee" label="Shopee" />}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Score geral"
          value={isLoading ? '—' : String(score?.overall ?? 0)}
          icon={Star}
          accent="primary"
        />
        <KpiCard
          label="Pontos penalidade"
          value={isLoading ? '—' : String(penalties?.penaltyPoints ?? 0)}
          icon={AlertTriangle}
          accent={penalties && penalties.penaltyPoints > 0 ? 'warning' : 'success'}
        />
        <KpiCard
          label="Cancelamento"
          value={isLoading ? '—' : `${penalties?.cancellationRate ?? 0}%`}
          icon={Percent}
        />
        <KpiCard
          label="Envio atrasado"
          value={isLoading ? '—' : `${penalties?.lateShipmentRate ?? 0}%`}
          icon={Clock}
          accent="warning"
        />
      </div>

      {scoreCategories.length > 0 && (
        <Panel title="Score por categoria">
          <div className="grid gap-3 sm:grid-cols-3">
            {scoreCategories.map((cat) => (
              <div key={cat.label} className="rounded-lg border border-border/60 px-4 py-3">
                <p className="text-xs text-muted-foreground">{cat.label}</p>
                <p className="font-mono text-xl font-semibold">{cat.value}</p>
              </div>
            ))}
          </div>
        </Panel>
      )}

      <Panel
        title="Alerta SLA"
        subtitle="Pedidos Shopee com prazo crítico"
        action={
          <Link to="/logistics/sla" className="text-xs text-primary hover:underline">
            Ver fila SLA →
          </Link>
        }
      >
        <p className="text-sm text-muted-foreground">
          Monitore pedidos Shopee com SLA de 4h em{' '}
          <Link to="/logistics/sla" className="text-primary hover:underline">
            Logística → SLA
          </Link>
          . Penalidades de envio atrasado impactam o score da loja.
        </p>
        {penalties && penalties.lateShipmentRate > 5 && (
          <StatusPill
            className="mt-3"
            label={`Taxa de atraso ${penalties.lateShipmentRate}% — acima do ideal`}
            tone="danger"
            dot
          />
        )}
      </Panel>

      <Panel title="Promoções ativas">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : promotions.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma promoção ativa.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-2 pr-4">Nome</th>
                  <th className="py-2 pr-4">Início</th>
                  <th className="py-2 pr-4">Fim</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {promotions.map((p) => (
                  <tr key={p.id} className="border-b border-border/50">
                    <td className="py-2 pr-4 font-medium">{p.name}</td>
                    <td className="py-2 pr-4 font-mono text-xs">
                      {new Date(p.startTime).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="py-2 pr-4 font-mono text-xs">
                      {new Date(p.endTime).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="py-2">
                      <StatusPill label={p.status} tone="primary" />
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
