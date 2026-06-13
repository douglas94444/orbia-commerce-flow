import { createFileRoute } from '@tanstack/react-router'
import { Instagram, Megaphone, Package } from 'lucide-react'
import { PageIntro, Panel } from '@/components/dashboard/panel'
import { KpiCard } from '@/components/dashboard/kpi-card'
import { formatBRL } from '@/lib/format'
import {
  useInstagramCommerce,
  useInstagramMetaAttribution,
  useIntegrationHealth,
} from '@/modules/marketplaces/hooks/use-marketplaces'
import {
  ChannelSubNav,
  ChannelOAuthBanner,
} from '@/modules/marketplaces/components/channel-sub-nav'

export const Route = createFileRoute('/_dashboard/channels/instagram')({
  head: () => ({ meta: [{ title: 'Instagram — Canais' }] }),
  component: InstagramPage,
})

function InstagramPage() {
  const { data: health = [] } = useIntegrationHealth()
  const { data: commerce, isLoading: loadingCommerce } = useInstagramCommerce()
  const { data: attribution, isLoading: loadingAttr } = useInstagramMetaAttribution()

  const igHealth = health.find((h) => h.provider === 'instagram')
  const isDisconnected = !igHealth || igHealth.status === 'down'

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Instagram Commerce"
        title="Catálogo Meta e atribuição de anúncios"
        description="Produtos sincronizados com o catálogo Meta e pedidos com metadata.meta_ads_attribution."
      />
      <ChannelSubNav />

      {isDisconnected && <ChannelOAuthBanner provider="instagram" label="Instagram" />}

      <div className="grid gap-4 sm:grid-cols-2">
        <KpiCard
          label="Produtos sincronizados"
          value={loadingCommerce ? '—' : String(commerce?.synced ?? 0)}
          icon={Package}
          accent="primary"
        />
        <KpiCard
          label="Catalog ID"
          value={loadingCommerce ? '—' : (commerce?.catalogId ?? '—')}
          icon={Instagram}
        />
      </div>

      <Panel title="Sync Commerce" subtitle="Última sincronização com catálogo Meta">
        {loadingCommerce ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : (
          <p className="text-sm text-muted-foreground">
            {commerce && commerce.synced > 0
              ? `${commerce.synced} produto(s) enviados ao catálogo ${commerce.catalogId ?? 'Meta'}.`
              : 'Nenhum produto sincronizado. Verifique a conexão OAuth e listings do canal Instagram.'}
          </p>
        )}
      </Panel>

      <Panel
        title="Atribuição Meta Ads"
        subtitle="Pedidos com campanha/anúncio vinculados"
        action={<Megaphone className="size-4 text-muted-foreground" />}
      >
        {loadingAttr ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : !attribution || attribution.totalOrders === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum pedido com atribuição Meta Ads registrada.
          </p>
        ) : (
          <>
            <p className="mb-4 text-sm text-muted-foreground">
              {attribution.totalOrders} pedido(s) · GMV total{' '}
              <span className="font-mono">{formatBRL(attribution.totalGmvCents / 100)}</span>
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="py-2 pr-4">Pedido</th>
                    <th className="py-2 pr-4">Campanha</th>
                    <th className="py-2 pr-4">Anúncio</th>
                    <th className="py-2 pr-4 font-mono">Spend</th>
                    <th className="py-2 font-mono">GMV</th>
                  </tr>
                </thead>
                <tbody>
                  {attribution.orders.map((o) => (
                    <tr key={o.orderId} className="border-b border-border/50">
                      <td className="py-2 pr-4 font-mono text-xs">{o.orderId}</td>
                      <td className="py-2 pr-4 font-mono text-xs">{o.campaignId ?? '—'}</td>
                      <td className="py-2 pr-4 font-mono text-xs">{o.adId ?? '—'}</td>
                      <td className="py-2 pr-4 font-mono">{formatBRL(o.spendCents / 100, true)}</td>
                      <td className="py-2 font-mono">{formatBRL(o.gmvCents / 100, true)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Panel>
    </div>
  )
}
