import { createFileRoute } from '@tanstack/react-router'
import { Package } from 'lucide-react'
import { PageIntro, Panel } from '@/components/dashboard/panel'
import { useProducts } from '@/modules/catalog/hooks/use-catalog'
import { formatBRL } from '@/lib/format'

export const Route = createFileRoute('/portal/catalog')({
  head: () => ({ meta: [{ title: 'Catálogo — Portal Orbia' }] }),
  component: PortalCatalogPage,
})

function PortalCatalogPage() {
  const { data: products = [], isLoading } = useProducts()

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Produtos"
        title="Seu catálogo"
        description="Visão somente leitura dos produtos sincronizados pela Orbia."
      />

      <Panel title="Produtos" action={<Package className="size-4 text-muted-foreground" />}>
        {isLoading ? (
          <div className="h-32 animate-pulse rounded-xl bg-muted/40" />
        ) : products.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum produto sincronizado ainda.</p>
        ) : (
          <div className="space-y-2">
            {products.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2 text-sm"
              >
                <div>
                  <span className="font-mono text-xs text-muted-foreground">{p.sku}</span>
                  <p>{p.name}</p>
                </div>
                <span className="font-mono">
                  {p.priceCents ? formatBRL(p.priceCents / 100) : '—'}
                </span>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  )
}
