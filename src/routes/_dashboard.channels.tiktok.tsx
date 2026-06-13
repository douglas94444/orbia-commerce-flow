import { createFileRoute } from '@tanstack/react-router'
import { Radio, ShoppingBag, Users, Video } from 'lucide-react'
import { PageIntro, Panel } from '@/components/dashboard/panel'
import { KpiCard } from '@/components/dashboard/kpi-card'
import { formatBRL } from '@/lib/format'
import { useTiktokMetrics, useIntegrationHealth } from '@/modules/marketplaces/hooks/use-marketplaces'
import {
  ChannelSubNav,
  ChannelOAuthBanner,
} from '@/modules/marketplaces/components/channel-sub-nav'

export const Route = createFileRoute('/_dashboard/channels/tiktok')({
  head: () => ({ meta: [{ title: 'TikTok Shop — Canais' }] }),
  component: TiktokPage,
})

function TiktokPage() {
  const { data: health = [] } = useIntegrationHealth()
  const { data, isLoading } = useTiktokMetrics()
  const sales = data?.salesByOrigin
  const affiliates = data?.affiliates ?? []

  const tiktokHealth = health.find((h) => h.provider === 'tiktok')
  const isDisconnected = !tiktokHealth || tiktokHealth.status === 'down'

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="TikTok Shop"
        title="Vendas por origem e afiliados"
        description="Distribuição de GMV entre live, vídeo e storefront. Dados dependem de metadata.tiktok_origin na ingestão."
      />
      <ChannelSubNav />

      {isDisconnected && <ChannelOAuthBanner provider="tiktok" label="TikTok Shop" />}

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard
          label="Live"
          value={isLoading ? '—' : String(sales?.live.orders ?? 0)}
          hint={sales ? formatBRL(sales.live.gmvCents / 100) : undefined}
          icon={Radio}
          accent="primary"
        />
        <KpiCard
          label="Vídeo"
          value={isLoading ? '—' : String(sales?.video.orders ?? 0)}
          hint={sales ? formatBRL(sales.video.gmvCents / 100) : undefined}
          icon={Video}
          accent="accent"
        />
        <KpiCard
          label="Storefront"
          value={isLoading ? '—' : String(sales?.shop.orders ?? 0)}
          hint={sales ? formatBRL(sales.shop.gmvCents / 100) : undefined}
          icon={ShoppingBag}
        />
      </div>

      {sales && (
        <Panel title="GMV por origem">
          <div className="space-y-3">
            {(
              [
                { key: 'live', label: 'Live', data: sales.live },
                { key: 'video', label: 'Vídeo', data: sales.video },
                { key: 'shop', label: 'Storefront', data: sales.shop },
              ] as const
            ).map(({ key, label, data: origin }) => {
              const total =
                sales.live.gmvCents + sales.video.gmvCents + sales.shop.gmvCents || 1
              const pct = Math.round((origin.gmvCents / total) * 100)
              return (
                <div key={key}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span>{label}</span>
                    <span className="font-mono">{pct}% · {formatBRL(origin.gmvCents / 100)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </Panel>
      )}

      <Panel title="Afiliados" subtitle="Comissões e pedidos por criador">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : affiliates.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum afiliado com vendas no período.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-2 pr-4">Afiliado</th>
                  <th className="py-2 pr-4 font-mono">Pedidos</th>
                  <th className="py-2 font-mono">Comissão</th>
                </tr>
              </thead>
              <tbody>
                {affiliates.map((a) => (
                  <tr key={a.affiliateId} className="border-b border-border/50">
                    <td className="py-2 pr-4">
                      <div className="flex items-center gap-2">
                        <Users className="size-3.5 text-muted-foreground" />
                        {a.affiliateName || a.affiliateId}
                      </div>
                    </td>
                    <td className="py-2 pr-4 font-mono">{a.orderCount}</td>
                    <td className="py-2 font-mono">{formatBRL(a.commissionCents / 100)}</td>
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
