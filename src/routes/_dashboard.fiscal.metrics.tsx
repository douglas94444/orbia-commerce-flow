import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { ArrowLeft, Upload } from 'lucide-react'
import { PageIntro, Panel } from '@/components/dashboard/panel'
import { KpiCard } from '@/components/dashboard/kpi-card'
import { Button } from '@/components/ui/button'
import { useFiscalMetrics, useImportTaxRules } from '@/modules/fiscal/hooks/use-fiscal'

export const Route = createFileRoute('/_dashboard/fiscal/metrics')({
  head: () => ({ meta: [{ title: 'Métricas Fiscal — Orbia' }] }),
  component: FiscalMetricsPage,
})

function FiscalMetricsPage() {
  const [days, setDays] = useState(30)
  const { data: metrics, isLoading } = useFiscalMetrics(days)
  const importRules = useImportTaxRules()

  return (
    <div className="space-y-6">
      <Link to="/fiscal" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" />
        Módulo Fiscal
      </Link>

      <PageIntro
        eyebrow="Saúde fiscal"
        title="Métricas e conformidade"
        description="Taxa de autorização, tempo médio SEFAZ, rejeições e alertas de certificado."
        action={
          <select
            className="h-9 rounded-lg border border-input bg-muted/40 px-3 text-sm"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            <option value={7}>7 dias</option>
            <option value={30}>30 dias</option>
            <option value={90}>90 dias</option>
          </select>
        }
      />

      {isLoading || !metrics ? (
        <div className="h-48 animate-pulse rounded-xl bg-muted/40" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {metrics.byType.map((t) => (
              <KpiCard
                key={t.type}
                label={`${t.type} (${days}d)`}
                value={`${t.authRate}%`}
                delta={`${t.authorized}/${t.total} autorizadas`}
              />
            ))}
            <KpiCard
              label="SKUs sem NCM"
              value={String(metrics.skusWithoutNcm)}
              delta={metrics.skusWithoutNcm > 0 ? 'atenção' : 'ok'}
            />
          </div>

          {(metrics.certExpiringSoon || metrics.certExpired) && (
            <Panel title="Alertas de certificado">
              {metrics.certExpired && (
                <p className="text-sm text-destructive">Certificado A1 vencido — renove imediatamente.</p>
              )}
              {metrics.certExpiringSoon && !metrics.certExpired && (
                <p className="text-sm text-warning">Certificado vence em menos de 30 dias.</p>
              )}
            </Panel>
          )}

          <Panel title="Top motivos de rejeição">
            {metrics.topRejectionReasons.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma rejeição no período.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {metrics.topRejectionReasons.map((r) => (
                  <li key={r.reason} className="flex justify-between gap-4">
                    <span className="text-muted-foreground">{r.reason}</span>
                    <span className="font-mono">{r.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Importar regras tributárias (CSV)" subtitle="Colunas: uf_destino, ncm_prefix, icms_aliquota, fcp_aliquota, difal_enabled, ipi_cst, mva_st">
            <Input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (!file) return
                const reader = new FileReader()
                reader.onload = () => {
                  const csv = reader.result as string
                  importRules.mutate(csv)
                }
                reader.readAsText(file)
              }}
            />
            <Button variant="outline" size="sm" className="mt-3 gap-2" disabled={importRules.isPending}>
              <Upload className="size-4" />
              Importar CSV
            </Button>
          </Panel>
        </>
      )}
    </div>
  )
}

function Input(props: React.ComponentProps<'input'>) {
  return (
    <input
      {...props}
      className="flex h-9 w-full rounded-lg border border-input bg-muted/40 px-3 text-sm file:border-0 file:bg-transparent"
    />
  )
}
