import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { AlertTriangle, FileSpreadsheet, Sparkles, X } from 'lucide-react'
import { PageIntro, Panel } from '@/components/dashboard/panel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { StatusPill } from '@/components/dashboard/status-pill'
import {
  useApplyFiscalTemplate,
  useBulkImportProductFiscal,
  useFiscalTemplates,
  useProductFiscalReadiness,
  useProducts,
  useSuggestProductNcm,
  useUpsertFiscalTemplate,
  useUpsertProductFiscal,
} from '@/modules/catalog/hooks/use-catalog'
import type { ProductRow } from '@/modules/catalog/actions.functions'

export const Route = createFileRoute('/_dashboard/catalog/fiscal')({
  head: () => ({ meta: [{ title: 'Fiscal por produto — Orbia' }] }),
  component: CatalogFiscalPage,
})

const BRAZIL_UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
]

function FiscalDrawer({
  product,
  onClose,
}: {
  product: ProductRow
  onClose: () => void
}) {
  const upsert = useUpsertProductFiscal()
  const suggest = useSuggestProductNcm()
  const [form, setForm] = useState({
    ncm: product.ncm ?? '',
    cfopIntra: product.cfopIntra ?? '',
    cfopInter: product.cfopInter ?? '',
    cfopReturnIntra: product.cfopReturnIntra ?? '',
    cfopReturnInter: product.cfopReturnInter ?? '',
    cst: product.cst ?? '',
    cest: product.cest ?? '',
    icmsSt: product.icmsSt,
    icmsOrigem: product.icmsOrigem,
    icmsRates: { ...product.icmsRates },
  })

  const setRate = (uf: string, value: string) => {
    const n = value === '' ? undefined : Number(value)
    setForm((f) => {
      const rates = { ...f.icmsRates }
      if (n == null || Number.isNaN(n)) delete rates[uf]
      else rates[uf] = n
      return { ...f, icmsRates: rates }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50">
      <div className="flex h-full w-full max-w-lg flex-col overflow-y-auto bg-background p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p className="font-mono text-xs text-muted-foreground">{product.sku}</p>
            <h2 className="font-display text-lg">{product.name}</h2>
          </div>
          <Button size="icon" variant="ghost" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>

        <div className="space-y-4">
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="mb-1 block text-xs text-muted-foreground">NCM (8 dígitos)</label>
              <Input
                className="font-mono"
                value={form.ncm}
                onChange={(e) => setForm((f) => ({ ...f, ncm: e.target.value }))}
              />
            </div>
            <Button
              size="sm"
              variant="outline"
              className="mt-5"
              disabled={suggest.isPending}
              onClick={() =>
                suggest.mutate(
                  { productName: product.name },
                  {
                    onSuccess: (res) => {
                      setForm((f) => ({ ...f, ncm: res.ncm }))
                      toastFromSuggest(res.rationale)
                    },
                  },
                )
              }
            >
              <Sparkles className="mr-1 size-3" />
              IA
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="CFOP venda intra" value={form.cfopIntra} onChange={(v) => setForm((f) => ({ ...f, cfopIntra: v }))} />
            <Field label="CFOP venda inter" value={form.cfopInter} onChange={(v) => setForm((f) => ({ ...f, cfopInter: v }))} />
            <Field label="CFOP devolução intra" value={form.cfopReturnIntra} onChange={(v) => setForm((f) => ({ ...f, cfopReturnIntra: v }))} />
            <Field label="CFOP devolução inter" value={form.cfopReturnInter} onChange={(v) => setForm((f) => ({ ...f, cfopReturnInter: v }))} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="CST / CSOSN" value={form.cst} onChange={(v) => setForm((f) => ({ ...f, cst: v }))} />
            <Field label="CEST (7 dígitos)" value={form.cest} onChange={(v) => setForm((f) => ({ ...f, cest: v }))} />
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.icmsSt}
                onChange={(e) => setForm((f) => ({ ...f, icmsSt: e.target.checked }))}
              />
              Sujeito a ICMS-ST
            </label>
            <div className="flex-1">
              <label className="mb-1 block text-xs text-muted-foreground">Origem mercadoria</label>
              <select
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                value={form.icmsOrigem}
                onChange={(e) => setForm((f) => ({ ...f, icmsOrigem: e.target.value }))}
              >
                {['0', '1', '2', '3', '4', '5', '6', '7', '8'].map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">Alíquota ICMS por UF destino (%)</p>
            <div className="grid max-h-40 grid-cols-4 gap-2 overflow-y-auto">
              {BRAZIL_UFS.map((uf) => (
                <div key={uf}>
                  <label className="text-[10px] text-muted-foreground">{uf}</label>
                  <Input
                    className="h-7 font-mono text-xs"
                    type="number"
                    placeholder="—"
                    value={form.icmsRates[uf] ?? ''}
                    onChange={(e) => setRate(uf, e.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>

          <Button
            className="w-full"
            disabled={upsert.isPending}
            onClick={() =>
              upsert.mutate(
                {
                  productId: product.id,
                  ncm: form.ncm || null,
                  cfopIntra: form.cfopIntra || null,
                  cfopInter: form.cfopInter || null,
                  cfopReturnIntra: form.cfopReturnIntra || null,
                  cfopReturnInter: form.cfopReturnInter || null,
                  cst: form.cst || null,
                  cest: form.cest || null,
                  icmsSt: form.icmsSt,
                  icmsOrigem: form.icmsOrigem,
                  icmsRates: form.icmsRates,
                },
                { onSuccess: onClose },
              )
            }
          >
            Salvar dados fiscais
          </Button>
        </div>
      </div>
    </div>
  )
}

function toastFromSuggest(rationale: string) {
  import('sonner').then(({ toast }) => toast.info(rationale))
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div>
      <label className="mb-1 block text-xs text-muted-foreground">{label}</label>
      <Input className="font-mono text-sm" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

function CatalogFiscalPage() {
  const { data: products = [], isLoading } = useProducts()
  const { data: readiness } = useProductFiscalReadiness()
  const { data: templates = [] } = useFiscalTemplates()
  const applyTemplate = useApplyFiscalTemplate()
  const upsertTemplate = useUpsertFiscalTemplate()
  const bulkImport = useBulkImportProductFiscal()

  const [editing, setEditing] = useState<ProductRow | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [templateId, setTemplateId] = useState('')
  const [csvText, setCsvText] = useState('')
  const [newTpl, setNewTpl] = useState({
    segment: 'moda',
    name: 'Moda — padrão',
    defaultNcm: '61091000',
    cfopIntra: '5102',
    cfopInter: '6102',
    defaultCst: '102',
  })

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const hasNcm = (p: ProductRow) => p.ncm && /^\d{8}$/.test(p.ncm.replace(/\D/g, ''))

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Fiscal"
        title="Configuração fiscal por produto"
        description="NCM, CFOP por operação, CEST/ST e alíquotas ICMS — usados na NF-e de venda e devolução."
        action={
          <Link to="/catalog">
            <Button size="sm" variant="outline">Voltar ao catálogo</Button>
          </Link>
        }
      />

      {readiness && readiness.incomplete > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-400" />
          <div className="text-sm">
            <p className="font-medium">
              {readiness.incomplete} SKU(s) sem NCM válido — cobertura {readiness.coveragePct}%
            </p>
            {readiness.missingSkus.length > 0 && (
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                {readiness.missingSkus.map((s) => s.sku).join(', ')}
                {readiness.incomplete > readiness.missingSkus.length ? '…' : ''}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Importar CSV" action={<FileSpreadsheet className="size-4 text-muted-foreground" />}>
          <p className="mb-2 text-xs text-muted-foreground">
            Colunas: sku, ncm, cfop_intra, cfop_inter, cst, cest
          </p>
          <textarea
            className="mb-2 min-h-24 w-full rounded-md border border-border bg-background p-2 font-mono text-xs"
            placeholder="sku,ncm,cfop_intra&#10;SKU-001,61091000,5102"
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
          />
          <Button size="sm" disabled={!csvText || bulkImport.isPending} onClick={() => bulkImport.mutate(csvText)}>
            Importar
          </Button>
        </Panel>

        <Panel title="Templates por segmento">
          <div className="mb-3 space-y-2">
            <div className="flex flex-wrap gap-2">
              <Input className="w-28 text-sm" placeholder="segmento" value={newTpl.segment} onChange={(e) => setNewTpl((t) => ({ ...t, segment: e.target.value }))} />
              <Input className="flex-1 text-sm" placeholder="Nome" value={newTpl.name} onChange={(e) => setNewTpl((t) => ({ ...t, name: e.target.value }))} />
              <Button
                size="sm"
                variant="outline"
                disabled={upsertTemplate.isPending}
                onClick={() => upsertTemplate.mutate(newTpl)}
              >
                Criar template
              </Button>
            </div>
          </div>
          {templates.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum template. Crie um acima.</p>
          ) : (
            <div className="space-y-2">
              {templates.map((t) => (
                <div key={t.id} className="flex justify-between text-sm">
                  <span>{t.name} <span className="font-mono text-xs text-muted-foreground">({t.segment})</span></span>
                  <span className="font-mono text-xs">NCM {t.defaultNcm ?? '—'}</span>
                </div>
              ))}
            </div>
          )}
          {templates.length > 0 && (
            <div className="mt-3 flex gap-2">
              <select
                className="flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
              >
                <option value="">Selecionar template</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              <Button
                size="sm"
                disabled={!templateId || selected.size === 0 || applyTemplate.isPending}
                onClick={() =>
                  applyTemplate.mutate({
                    templateId,
                    productIds: [...selected],
                  })
                }
              >
                Aplicar ({selected.size})
              </Button>
            </div>
          )}
        </Panel>
      </div>

      <Panel title="Produtos" subtitle={`${products.length} SKUs — clique para editar fiscal completo`}>
        {isLoading ? (
          <div className="h-32 animate-pulse rounded-xl bg-muted/40" />
        ) : products.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum produto. Sincronize um canal primeiro.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                  <th className="pb-2 pr-2 w-8" />
                  <th className="pb-2 pr-4">SKU</th>
                  <th className="pb-2 pr-4">NCM</th>
                  <th className="pb-2 pr-4">CFOP intra/inter</th>
                  <th className="pb-2 pr-4">CST</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr
                    key={p.id}
                    className="cursor-pointer border-b border-border/50 hover:bg-muted/30"
                    onClick={() => setEditing(p)}
                  >
                    <td className="py-2 pr-2" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected.has(p.id)}
                        onChange={() => toggleSelect(p.id)}
                      />
                    </td>
                    <td className="py-2 pr-4 font-mono text-xs">{p.sku}</td>
                    <td className="py-2 pr-4 font-mono text-xs">{p.ncm ?? '—'}</td>
                    <td className="py-2 pr-4 font-mono text-xs">
                      {p.cfopIntra ?? '—'} / {p.cfopInter ?? '—'}
                    </td>
                    <td className="py-2 pr-4 font-mono text-xs">{p.cst ?? '—'}</td>
                    <td className="py-2">
                      <StatusPill
                        label={hasNcm(p) ? 'Completo' : 'Incompleto'}
                        tone={hasNcm(p) ? 'success' : 'warning'}
                        dot
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {editing && <FiscalDrawer product={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}
