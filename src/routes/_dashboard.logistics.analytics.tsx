import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, BarChart3 } from "lucide-react";
import { PageIntro, Panel } from "@/components/dashboard/panel";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/format";
import { useLogisticsAnalytics, useStockTurnover } from "@/modules/logistics/hooks/use-fulfillly";
import { PackageCheck, Truck, Target, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_dashboard/logistics/analytics")({
  head: () => ({ meta: [{ title: "Analytics Logística — Orbia" }] }),
  component: LogisticsAnalyticsPage,
});

function LogisticsAnalyticsPage() {
  const { data, isLoading } = useLogisticsAnalytics();
  const { data: turnover = [], isLoading: loadingTurnover } = useStockTurnover();

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Fulfillly"
        title="Analytics logística"
        description="Custo de entrega, acurácia de picking e produtividade ops."
        action={<BarChart3 className="size-5 text-primary" />}
      />

      <Link to="/logistics">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="mr-2 size-4" />
          Voltar à logística
        </Button>
      </Link>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label="Custo médio entrega"
          value={isLoading ? "—" : formatBRL((data?.avgShippingCostCents ?? 0) / 100)}
          icon={Truck}
          accent="primary"
        />
        <KpiCard
          label="Entregas no SLA"
          value={isLoading ? "—" : `${data?.onTimeDeliveryPercent ?? 0}%`}
          icon={Target}
          accent="success"
        />
        <KpiCard
          label="Acurácia picking"
          value={isLoading ? "—" : `${data?.pickingAccuracyPercent ?? 0}%`}
          icon={PackageCheck}
          accent="primary"
        />
        <KpiCard
          label="Taxa incidentes"
          value={isLoading ? "—" : `${data?.incidentRatePercent ?? 0}%`}
          icon={AlertTriangle}
          accent="warning"
        />
      </div>

      <Panel title="Giro de estoque por SKU (30d)">
        {loadingTurnover ? (
          <div className="h-24 animate-pulse rounded-xl bg-muted/40" />
        ) : turnover.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem dados de giro</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                  <th className="pb-2">SKU</th>
                  <th className="pb-2">Saídas 30d</th>
                  <th className="pb-2">Estoque</th>
                  <th className="pb-2">Giro</th>
                </tr>
              </thead>
              <tbody>
                {turnover.slice(0, 20).map((row) => (
                  <tr key={row.sku} className="border-b border-border/50">
                    <td className="py-2 font-mono">{row.sku}</td>
                    <td className="py-2 font-mono">{row.unitsSold30d}</td>
                    <td className="py-2 font-mono">{row.avgInventory}</td>
                    <td className="py-2 font-mono">{row.turnover}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Produtividade ops (últimas 24h)">
        {isLoading ? (
          <div className="h-24 animate-pulse rounded-xl bg-muted/40" />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">Picks concluídos</p>
              <p className="font-mono text-2xl font-bold">{data?.picksLast24h ?? 0}</p>
              <p className="text-xs text-muted-foreground">{data?.picksPerHour ?? 0}/h média</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Packs concluídos</p>
              <p className="font-mono text-2xl font-bold">{data?.packsLast24h ?? 0}</p>
              <p className="text-xs text-muted-foreground">{data?.packsPerHour ?? 0}/h média</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Pedidos entregues (30d)</p>
              <p className="font-mono text-2xl font-bold">{data?.deliveredCount ?? 0}</p>
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}
