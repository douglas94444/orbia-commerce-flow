import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft, Download } from 'lucide-react'
import { PageIntro, Panel } from '@/components/dashboard/panel'
import { Button } from '@/components/ui/button'
import { useFiscalAccountantExport } from '@/modules/fiscal/hooks/use-fiscal'

export const Route = createFileRoute('/_dashboard/fiscal/portal')({
  head: () => ({ meta: [{ title: 'Portal Contador — Orbia' }] }),
  component: FiscalPortalPage,
})

function FiscalPortalPage() {
  const exportCsv = useFiscalAccountantExport()

  return (
    <div className="space-y-6">
      <Link to="/fiscal" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" />
        Módulo Fiscal
      </Link>

      <PageIntro
        eyebrow="Somente leitura"
        title="Portal do contador"
        description="Exportação de NF autorizadas para escrituração. Sem permissão de cancelamento ou emissão."
      />

      <Panel title="Exportações">
        <p className="mb-4 text-sm text-muted-foreground">
          Baixe o CSV com chaves, séries e valores das notas autorizadas nos últimos 30 ou 90 dias.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            disabled={exportCsv.isPending}
            onClick={() =>
              exportCsv.mutate(30, {
                onSuccess: ({ csv, filename }) => {
                  const blob = new Blob([csv], { type: 'text/csv' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = filename
                  a.click()
                  URL.revokeObjectURL(url)
                },
              })
            }
          >
            <Download className="mr-2 size-4" />
            CSV 30 dias
          </Button>
          <Button
            variant="outline"
            disabled={exportCsv.isPending}
            onClick={() =>
              exportCsv.mutate(90, {
                onSuccess: ({ csv, filename }) => {
                  const blob = new Blob([csv], { type: 'text/csv' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = filename
                  a.click()
                  URL.revokeObjectURL(url)
                },
              })
            }
          >
            <Download className="mr-2 size-4" />
            CSV 90 dias
          </Button>
        </div>
      </Panel>
    </div>
  )
}
