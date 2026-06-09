import { createFileRoute } from '@tanstack/react-router'
import { Package, RefreshCw } from 'lucide-react'
import { PageIntro, Panel } from '@/components/dashboard/panel'
import { Button } from '@/components/ui/button'
import { useChannelListings, useProducts, useSyncAllCatalogs } from '@/modules/catalog/hooks/use-catalog'
import { formatBRL } from '@/lib/format'

export const Route = createFileRoute('/_dashboard/catalog')({
  head: () => ({ meta: [{ title: 'Catálogo — Orbia' }] }),
  component: CatalogPage,
})

function CatalogPage() {
  const { data: products = [], isLoading } = useProducts()
  const { data: listings = [] } = useChannelListings()
  const syncAll = useSyncAllCatalogs()

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Operações"
        title="Catálogo centralizado"
        description="Produtos mestre e listagens por canal (Nuvemshop, Shopify, ML, Shopee)."
        action={
          <Button
            size="sm"
            disabled={syncAll.isPending}
            onClick={() => syncAll.mutate()}
          >
            <RefreshCw className={`mr-2 size-4 ${syncAll.isPending ? 'animate-spin' : ''}`} />
            Sincronizar tudo
          </Button>
        }
      />

      <Panel title="Produtos" action={<Package className="size-4 text-muted-foreground" />}>
        {isLoading ? (
          <div className="h-32 animate-pulse rounded-xl bg-muted/40" />
        ) : products.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum produto. Conecte um canal e sincronize.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                  <th className="pb-2 pr-4">SKU</th>
                  <th className="pb-2 pr-4">Nome</th>
                  <th className="pb-2 pr-4">NCM</th>
                  <th className="pb-2">Preço</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} className="border-b border-border/50">
                    <td className="py-2 pr-4 font-mono text-xs">{p.sku}</td>
                    <td className="py-2 pr-4">{p.name}</td>
                    <td className="py-2 pr-4 font-mono text-xs">{p.ncm ?? '—'}</td>
                    <td className="py-2 font-mono">
                      {p.priceCents ? formatBRL(p.priceCents / 100) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Listagens por canal" subtitle={`${listings.length} mapeamentos`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                <th className="pb-2 pr-4">Canal</th>
                <th className="pb-2 pr-4">SKU</th>
                <th className="pb-2 pr-4">ID externo</th>
                <th className="pb-2">Último sync</th>
              </tr>
            </thead>
            <tbody>
              {listings.map((l) => (
                <tr key={l.id} className="border-b border-border/50">
                  <td className="py-2 pr-4">{l.channel}</td>
                  <td className="py-2 pr-4 font-mono text-xs">{l.sku}</td>
                  <td className="py-2 pr-4 font-mono text-xs">{l.externalProductId}</td>
                  <td className="py-2 text-xs text-muted-foreground">
                    {l.lastSyncedAt ? new Date(l.lastSyncedAt).toLocaleString('pt-BR') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  )
}
