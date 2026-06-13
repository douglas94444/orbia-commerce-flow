import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { AlertTriangle, Package, RefreshCw, Upload } from 'lucide-react'
import { PageIntro, Panel } from '@/components/dashboard/panel'
import { StatusPill } from '@/components/dashboard/status-pill'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  useChannelListings,
  useProducts,
  usePricingRules,
  useProductFiscalReadiness,
  usePublishSku,
  useStockBuffers,
  useSyncAllCatalogs,
  useUpsertPricingRule,
  useUpsertStockBuffer,
} from '@/modules/catalog/hooks/use-catalog'
import { formatBRL } from '@/lib/format'

export const Route = createFileRoute('/_dashboard/catalog')({
  head: () => ({ meta: [{ title: 'Catálogo — Orbia' }] }),
  component: CatalogPage,
})

const CHANNELS = ['nuvemshop', 'shopify', 'mercado_livre', 'shopee', 'amazon', 'tiktok'] as const

function CatalogPage() {
  const { data: products = [], isLoading } = useProducts()
  const { data: listings = [] } = useChannelListings()
  const { data: pricingRules = [] } = usePricingRules()
  const { data: stockBuffers = [] } = useStockBuffers()
  const { data: readiness } = useProductFiscalReadiness()
  const syncAll = useSyncAllCatalogs()
  const publishSku = usePublishSku()
  const upsertPricing = useUpsertPricingRule()
  const upsertBuffer = useUpsertStockBuffer()

  const [publishSkuInput, setPublishSkuInput] = useState('')
  const [pricingChannel, setPricingChannel] = useState('mercado_livre')
  const [pricingValue, setPricingValue] = useState('16')
  const [bufferChannel, setBufferChannel] = useState('nuvemshop')
  const [bufferPct, setBufferPct] = useState('10')

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Operações"
        title="Catálogo centralizado"
        description="Publique uma vez, venda em 6 canais — preço, estoque e buffers por marketplace."
        action={
          <div className="flex gap-2">
            <Link to="/catalog/fiscal">
              <Button size="sm" variant="outline">Fiscal por produto</Button>
            </Link>
            <Button size="sm" disabled={syncAll.isPending} onClick={() => syncAll.mutate()}>
              <RefreshCw className={`mr-2 size-4 ${syncAll.isPending ? 'animate-spin' : ''}`} />
              Sincronizar tudo
            </Button>
          </div>
        }
      />

      {readiness && readiness.incomplete > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <div className="flex items-center gap-2 text-sm">
            <AlertTriangle className="size-4 text-amber-400" />
            <span>
              {readiness.incomplete} SKU(s) sem NCM — cobertura fiscal {readiness.coveragePct}%
            </span>
          </div>
          <Link to="/catalog/fiscal">
            <Button size="sm" variant="outline">Completar fiscal</Button>
          </Link>
        </div>
      )}

      <Panel title="Publicar SKU" action={<Upload className="size-4 text-muted-foreground" />}>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">SKU</label>
            <Input
              className="w-48 font-mono text-sm"
              placeholder="SKU-001"
              value={publishSkuInput}
              onChange={(e) => setPublishSkuInput(e.target.value)}
            />
          </div>
          <Button
            size="sm"
            disabled={!publishSkuInput || publishSku.isPending}
            onClick={() => publishSku.mutate({ sku: publishSkuInput, channels: [...CHANNELS] })}
          >
            Publicar em todos os canais
          </Button>
        </div>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Regras de precificação">
          <div className="mb-4 flex flex-wrap gap-2">
            <select
              className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
              value={pricingChannel}
              onChange={(e) => setPricingChannel(e.target.value)}
            >
              {CHANNELS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <Input
              className="w-20 font-mono text-sm"
              type="number"
              value={pricingValue}
              onChange={(e) => setPricingValue(e.target.value)}
              placeholder="%"
            />
            <Button
              size="sm"
              variant="outline"
              disabled={upsertPricing.isPending}
              onClick={() =>
                upsertPricing.mutate({
                  channel: pricingChannel,
                  ruleType: 'margin_pct',
                  value: Number(pricingValue),
                })
              }
            >
              Salvar margem %
            </Button>
          </div>
          {pricingRules.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma regra configurada.</p>
          ) : (
            <div className="space-y-1 text-sm">
              {pricingRules.map((r) => (
                <div key={r.id} className="flex justify-between font-mono text-xs">
                  <span>{r.channel} · {r.ruleType}</span>
                  <span>{r.value}{r.ruleType.includes('pct') ? '%' : '¢'}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Buffers de estoque">
          <div className="mb-4 flex flex-wrap gap-2">
            <select
              className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
              value={bufferChannel}
              onChange={(e) => setBufferChannel(e.target.value)}
            >
              {CHANNELS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <Input
              className="w-20 font-mono text-sm"
              type="number"
              value={bufferPct}
              onChange={(e) => setBufferPct(e.target.value)}
            />
            <Button
              size="sm"
              variant="outline"
              disabled={upsertBuffer.isPending}
              onClick={() =>
                upsertBuffer.mutate({
                  channel: bufferChannel,
                  bufferPct: Number(bufferPct),
                  blackoutWhenZero: true,
                })
              }
            >
              Salvar buffer %
            </Button>
          </div>
          {stockBuffers.length === 0 ? (
            <p className="text-sm text-muted-foreground">Buffers padrão: 0% reservado.</p>
          ) : (
            <div className="space-y-1 text-sm">
              {stockBuffers.map((b) => (
                <div key={b.id} className="flex justify-between font-mono text-xs">
                  <span>{b.channel}</span>
                  <span>{b.bufferPct}% reservado · blackout {b.blackoutWhenZero ? 'sim' : 'não'}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <Panel
        title="Produtos"
        action={<Package className="size-4 text-muted-foreground" />}
        subtitle="Dados fiscais completos em Fiscal por produto"
      >
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
                  <th className="pb-2 pr-4">Preço base</th>
                  <th className="pb-2 pr-4">NCM</th>
                  <th className="pb-2">Ação</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => {
                  const ncmOk = p.ncm && /^\d{8}$/.test(p.ncm.replace(/\D/g, ''))
                  return (
                    <tr key={p.id} className="border-b border-border/50">
                      <td className="py-2 pr-4 font-mono text-xs">{p.sku}</td>
                      <td className="py-2 pr-4">{p.name}</td>
                      <td className="py-2 pr-4 font-mono">
                        {p.priceCents ? formatBRL(p.priceCents / 100) : '—'}
                      </td>
                      <td className="py-2 pr-4">
                        <StatusPill
                          label={ncmOk ? (p.ncm ?? '') : 'Sem NCM'}
                          tone={ncmOk ? 'success' : 'warning'}
                          dot
                        />
                      </td>
                      <td className="py-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          disabled={publishSku.isPending}
                          onClick={() => publishSku.mutate({ sku: p.sku, channels: [...CHANNELS] })}
                        >
                          Publicar
                        </Button>
                      </td>
                    </tr>
                  )
                })}
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
                <th className="pb-2 pr-4">Preço canal</th>
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2">Último sync</th>
              </tr>
            </thead>
            <tbody>
              {listings.map((l) => (
                <tr key={l.id} className="border-b border-border/50">
                  <td className="py-2 pr-4">{l.channel}</td>
                  <td className="py-2 pr-4 font-mono text-xs">{l.sku}</td>
                  <td className="py-2 pr-4 font-mono text-xs">
                    {l.channelPriceCents ? formatBRL(l.channelPriceCents / 100, true) : '—'}
                  </td>
                  <td className="py-2 pr-4">
                    <StatusPill
                      label={l.listingStatus}
                      tone={l.listingStatus === 'active' ? 'success' : 'warning'}
                      dot
                    />
                  </td>
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
