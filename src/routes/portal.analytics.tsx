import { createFileRoute } from "@tanstack/react-router";
import { BarChart3, Download, Gauge, HeartPulse, Truck } from "lucide-react";
import { PageIntro, Panel } from "@/components/dashboard/panel";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/format";
import { useCurrentClient } from "@/modules/clients/hooks/use-current-client";
import { usePortfolioAnalytics, useDownloadMonthlyReport } from "@/modules/analytics/hooks/use-analytics";
import { AiInsightsPanel } from "@/components/dashboard/ai-insights-panel";

export const Route = createFileRoute("/portal/analytics")({
  head: () => ({ meta: [{ title: "Analytics — Portal Orbia" }] }),
  component: PortalAnalyticsPage,
});

function PortalAnalyticsPage() {
  const { data: client, isLoading: loadingClient } = useCurrentClient();
  const { data: analytics, isLoading: loadingAnalytics } = usePortfolioAnalytics();
  const downloadReport = useDownloadMonthlyReport(client?.clientId);

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow={client?.clientName ?? "Sua loja"}
        title="Analytics"
        description="Visão consolidada de performance, logística e saúde da operação."
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadReport.mutate()}
            disabled={downloadReport.isPending || !client?.clientId}
          >
            <Download className="mr-2 size-4" />
            Relatório mensal
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label="Health score"
          value={loadingClient ? "—" : String(client?.healthScore ?? 0)}
          icon={HeartPulse}
          accent="success"
        />
        <KpiCard
          label="ROAS"
          value={
            loadingClient
              ? "—"
              : client && client.roas > 0
                ? `${client.roas.toFixed(1)}x`
                : "—"
          }
          icon={Gauge}
          accent="primary"
        />
        <KpiCard
          label="GMV (30d)"
          value={
            loadingAnalytics
              ? "—"
              : analytics?.gmv30d
                ? formatBRL(analytics.gmv30d, true)
                : formatBRL((client?.gmv30d ?? 0) / 100, true)
          }
          icon={BarChart3}
          accent="accent"
        />
        <KpiCard
          label="SLA logística"
          value={
            loadingAnalytics
              ? "—"
              : `${analytics?.logistics?.slaCompliancePercent ?? 100}%`
          }
          icon={Truck}
          accent="primary"
        />
      </div>

      {analytics?.logistics && (
        <Panel title="Fulfillly — indicadores do mês">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">Picking</p>
              <p className="font-mono text-xl font-bold">
                {analytics.logistics.pickingAccuracyPercent}%
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Incidentes</p>
              <p className="font-mono text-xl font-bold">
                {analytics.logistics.incidentRatePercent}%
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Pedidos processados</p>
              <p className="font-mono text-xl font-bold">
                {analytics.logistics.fulfillmentOrdersMonth}
              </p>
            </div>
          </div>
        </Panel>
      )}

      <AiInsightsPanel clientId={client?.clientId} title="Recomendações para sua loja" />
    </div>
  );
}
