import { createFileRoute } from "@tanstack/react-router";
import { BarChart3, Coins, Gauge, Percent, Truck } from "lucide-react";
import { PageIntro, Panel } from "@/components/dashboard/panel";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { GmvRoasChart, ChannelRoasChart } from "@/components/dashboard/charts";
import { usePortfolioAnalytics } from "@/modules/analytics/hooks/use-analytics";
import { formatBRL } from "@/lib/format";

export const Route = createFileRoute("/_dashboard/analytics")({
  head: () => ({ meta: [{ title: "Analytics — Orbia" }] }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const { data, isLoading } = usePortfolioAnalytics();

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Analytics 360"
        title="Dados cruzados da operação"
        description="Visão consolidada de GMV, ROAS, SLA e NF — agregados dos módulos conectados."
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
          value="em breve"
          icon={Percent}
          accent="warning"
        />
      </div>

      <Panel title="GMV vs ROAS" subtitle="Tendência consolidada — 30 dias">
        <GmvRoasChart data={isLoading ? undefined : data?.gmvRoasSeries} />
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="ROAS por canal">
          <ChannelRoasChart data={isLoading ? undefined : data?.channelRoas} />
        </Panel>

        <Panel title="Retenção por cohort" subtitle="Disponível após módulo de retenção">
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <p className="text-sm text-muted-foreground">Cohort e LTV — em breve</p>
          </div>
        </Panel>
      </div>
    </div>
  );
}
