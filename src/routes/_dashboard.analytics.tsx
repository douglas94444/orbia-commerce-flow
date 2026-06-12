import { createFileRoute } from "@tanstack/react-router";
import { BarChart3, Coins, Gauge, Percent, Truck, Download, PackageCheck, AlertTriangle, FileText } from "lucide-react";
import { PageIntro, Panel } from "@/components/dashboard/panel";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { GmvRoasChart, ChannelRoasChart } from "@/components/dashboard/charts";
import { Button } from "@/components/ui/button";
import {
  usePortfolioAnalytics,
  useExportPortfolioAnalytics,
  useDownloadMonthlyReport,
} from "@/modules/analytics/hooks/use-analytics";
import { AiInsightsPanel } from "@/components/dashboard/ai-insights-panel";
import { BenchmarksPanel } from "@/components/dashboard/benchmarks-panel";
import { formatBRL } from "@/lib/format";

export const Route = createFileRoute("/_dashboard/analytics")({
  head: () => ({ meta: [{ title: "Analytics — Orbia" }] }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const { data, isLoading } = usePortfolioAnalytics();
  const exportCsv = useExportPortfolioAnalytics();
  const downloadMonthly = useDownloadMonthlyReport();

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Analytics 360"
        title="Dados cruzados da operação"
        description="Visão consolidada de GMV, ROAS, margem, SLA, logística e retenção por cohort."
        action={
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportCsv.mutate()}
              disabled={exportCsv.isPending}
            >
              <Download className="mr-2 size-4" />
              CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => downloadMonthly.mutate()}
              disabled={downloadMonthly.isPending}
            >
              <FileText className="mr-2 size-4" />
              Relatório mensal
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <KpiCard
          label="GMV (30d)"
          value={isLoading ? "—" : data?.gmv30d ? formatBRL(data.gmv30d, true) : "—"}
          icon={Coins}
          accent="primary"
        />
        <KpiCard
          label="ROAS médio"
          value={isLoading ? "—" : data?.avgRoas ? `${data.avgRoas}x` : "—"}
          icon={Gauge}
          accent="accent"
        />
        <KpiCard
          label="NF emitidas"
          value={isLoading ? "—" : String(data?.nfeEmitted ?? 0)}
          icon={BarChart3}
          accent="success"
        />
        <KpiCard
          label="SLA entrega"
          value={isLoading ? "—" : data ? `${data.slaPercent}%` : "—"}
          icon={Truck}
          accent="success"
        />
        <KpiCard
          label="Margem real"
          value={isLoading ? "—" : data ? `${data.marginPercent}%` : "—"}
          hint={
            data?.adSpend30d
              ? `Ads: ${formatBRL(data.adSpend30d, true)}`
              : "GMV − investimento em mídia"
          }
          icon={Percent}
          accent="warning"
        />
      </div>

      {data?.logistics && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard
            label="SLA logística"
            value={isLoading ? "—" : `${data.logistics.slaCompliancePercent}%`}
            icon={Truck}
            accent="primary"
          />
          <KpiCard
            label="Picking"
            value={isLoading ? "—" : `${data.logistics.pickingAccuracyPercent}%`}
            icon={PackageCheck}
            accent="accent"
          />
          <KpiCard
            label="Incidentes"
            value={isLoading ? "—" : `${data.logistics.incidentRatePercent}%`}
            icon={AlertTriangle}
            accent="warning"
          />
          <KpiCard
            label="Fulfillment mês"
            value={isLoading ? "—" : String(data.logistics.fulfillmentOrdersMonth)}
            hint={
              data.logistics.avgShippingCostCents > 0
                ? `Frete médio ${formatBRL(data.logistics.avgShippingCostCents / 100)}`
                : undefined
            }
            icon={BarChart3}
            accent="success"
          />
        </div>
      )}

      <Panel title="GMV vs ROAS" subtitle="Tendência consolidada — 30 dias">
        <GmvRoasChart data={isLoading ? undefined : data?.gmvRoasSeries} />
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="ROAS por canal">
          <ChannelRoasChart data={isLoading ? undefined : data?.channelRoas} />
        </Panel>

        <Panel title="LTV por cohort de aquisição" subtitle="LTV médio por mês da primeira compra">
          {isLoading ? (
            <div className="h-32 animate-pulse rounded-xl bg-muted/40" />
          ) : !data?.ltvByCohort?.length ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Sem dados de clientes ainda.</p>
          ) : (
            <div className="space-y-2">
              {data.ltvByCohort.map((row) => (
                <div key={row.cohort} className="flex justify-between text-sm border-b border-border/50 pb-2">
                  <span>{row.cohort}</span>
                  <span className="font-mono">
                    {formatBRL(row.avgLtv)} <span className="text-muted-foreground">({row.customers})</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Retenção por cohort" subtitle="Compradores ativos por mês desde primeira compra">
          {isLoading ? (
            <div className="h-32 animate-pulse rounded-xl bg-muted/40" />
          ) : !data?.cohortRetention?.length ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Dados insuficientes para cohort (pedidos com e-mail/telefone do comprador).
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                    <th className="pb-2">Cohort</th>
                    <th className="pb-2">M0</th>
                    <th className="pb-2">M1</th>
                    <th className="pb-2">M2</th>
                    <th className="pb-2">M3</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border font-mono">
                  {data.cohortRetention.map((row) => (
                    <tr key={row.cohort}>
                      <td className="py-2 text-foreground">{row.cohort}</td>
                      <td className="py-2">{row.month0}%</td>
                      <td className="py-2">{row.month1}%</td>
                      <td className="py-2">{row.month2}%</td>
                      <td className="py-2">{row.month3}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      <BenchmarksPanel />
      <AiInsightsPanel />
    </div>
  );
}
