import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { ArrowLeft, Download, Search } from 'lucide-react'
import { PageIntro, Panel } from '@/components/dashboard/panel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { StatusPill } from '@/components/dashboard/status-pill'
import { formatBRL } from '@/lib/format'
import {
  useSearchNfEmissions,
  useExportNfePeriodZip,
} from '@/modules/fiscal/hooks/use-fiscal'

export const Route = createFileRoute('/_dashboard/fiscal/search')({
  head: () => ({ meta: [{ title: 'Consulta Fiscal — Orbia' }] }),
  component: FiscalSearchPage,
})

function FiscalSearchPage() {
  const [accessKey, setAccessKey] = useState('')
  const [orderId, setOrderId] = useState('')
  const [cpfCnpj, setCpfCnpj] = useState('')
  const [type, setType] = useState<'all' | 'NF-e' | 'NFC-e' | 'NFS-e'>('all')

  const { data: results = [], refetch, isFetching } = useSearchNfEmissions({
    accessKey: accessKey || undefined,
    orderId: orderId || undefined,
    cpfCnpj: cpfCnpj || undefined,
    type: type === 'all' ? undefined : type,
    enabled: false,
  })

  const exportZip = useExportNfePeriodZip()

  return (
    <div className="space-y-6">
      <Link to="/fiscal" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" />
        Módulo Fiscal
      </Link>

      <PageIntro
        eyebrow="Consulta"
        title="Buscar notas fiscais"
        description="Por chave de acesso, pedido, CPF/CNPJ do tomador ou tipo de documento."
        action={
          <Button
            size="sm"
            variant="outline"
            disabled={exportZip.isPending}
            onClick={() =>
              exportZip.mutate(30, {
                onSuccess: ({ files }) => {
                  files.forEach((f) => window.open(f.url, '_blank'))
                },
              })
            }
          >
            <Download className="mr-2 size-4" />
            URLs XML (30d)
          </Button>
        }
      />

      <Panel title="Filtros">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Chave de acesso</label>
            <Input value={accessKey} onChange={(e) => setAccessKey(e.target.value)} className="font-mono text-xs" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">ID do pedido</label>
            <Input value={orderId} onChange={(e) => setOrderId(e.target.value)} className="font-mono text-xs" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">CPF/CNPJ tomador</label>
            <Input value={cpfCnpj} onChange={(e) => setCpfCnpj(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Tipo</label>
            <select
              className="h-9 w-full rounded-lg border border-input bg-muted/40 px-3 text-sm"
              value={type}
              onChange={(e) => setType(e.target.value as typeof type)}
            >
              <option value="all">Todos</option>
              <option value="NF-e">NF-e</option>
              <option value="NFC-e">NFC-e</option>
              <option value="NFS-e">NFS-e</option>
            </select>
          </div>
        </div>
        <Button className="mt-4 gap-2" onClick={() => refetch()} disabled={isFetching}>
          <Search className="size-4" />
          Buscar
        </Button>
      </Panel>

      <Panel title="Resultados" subtitle={`${results.length} documento(s)`}>
        {results.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum resultado. Ajuste os filtros e busque novamente.</p>
        ) : (
          <div className="space-y-2">
            {results.map((nf) => (
              <Link
                key={nf.emissionId}
                to="/fiscal/$id"
                params={{ id: nf.emissionId }}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/20 px-4 py-3 text-sm hover:bg-muted/40"
              >
                <div>
                  <span className="font-mono font-medium">{nf.id}</span>
                  <span className="ml-2 text-muted-foreground">{nf.type}</span>
                  <StatusPill label={nf.status} tone={nf.status === 'autorizada' ? 'success' : 'warning'} className="ml-2" />
                </div>
                <span className="font-mono">{formatBRL(nf.value)}</span>
              </Link>
            ))}
          </div>
        )}
      </Panel>
    </div>
  )
}
