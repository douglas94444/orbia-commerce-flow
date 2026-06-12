import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, BarChart3, Download } from "lucide-react";
import { PageIntro, Panel } from "@/components/dashboard/panel";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/format";
import {
  useLogisticsAnalyticsDashboard,
  useOperatorPerformance,
  useStockTurnover,
  useExportLogisticsAnalyticsCsv,
  useUnifiedOccurrences,
  useExportOccurrencesCsv,
} from "@/modules/logistics/hooks/use-fulfillly";
import { PackageCheck, Truck, Target, AlertTriangle, Clock, MapPin } from "lucide-react";
import { ShippingCostTrendChart } from "@/components/dashboard/charts";
import { useDeliveryHeatMap } from "@/modules/logistics/hooks/use-fulfillly";

export const Route = createFileRoute("/_dashboard/logistics/analytics")({
  head: () => ({ meta: [{ title: "Analytics Logística — Orbia" }] }),
  component: LogisticsAnalyticsPage,
});

function LogisticsAnalyticsPage() {
  const { data: dashboard, isLoading } = useLogisticsAnalyticsDashboard();
  const { data: turnover = [], isLoading: loadingTurnover } = useStockTurnover();
  const { data: operators = [], isLoading: loadingOperators } = useOperatorPerformance();
  const exportCsv = useExportLogisticsAnalyticsCsv();
  const exportOccurrences = useExportOccurrencesCsv();
  const { data: occurrences = [], isLoading: loadingOccurrences } = useUnifiedOccurrences();
  const { data: deliveryHeat = [], isLoading: loadingHeat } = useDeliveryHeatMap();

  const data = dashboard?.summary;

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Fulfillly"
        title="Analytics logística"
        description="Custo de entrega, acurácia de picking, tempo por etapa e volume por canal."
        action={<BarChart3 className="size-5 text-primary" />}
      />

      <div className="flex flex-wrap gap-2">
        <Link to="/logistics">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 size-4" />
            Voltar à logística
          </Button>
        </Link>
        <Button
          variant="outline"
          size="sm"
          onClick={() => exportCsv.mutate()}
          disabled={exportCsv.isPending}
        >
          <Download className="mr-2 size-4" />
          Exportar analytics
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => exportOccurrences.mutate()}
          disabled={exportOccurrences.isPending}
        >
          <Download className="mr-2 size-4" />
          Exportar ocorrências
        </Button>
      </div>

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

      <Panel title="Tempo médio por etapa (30d)" subtitle="Mediana e P95 em horas">
        {isLoading ? (
          <div className="h-24 animate-pulse rounded-xl bg-muted/40" />
        ) : !dashboard?.stageDurations?.length ? (
          <p className="text-sm text-muted-foreground">Sem eventos de pedido no período</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                  <th className="pb-2">Etapa</th>
                  <th className="pb-2">Mediana (h)</th>
                  <th className="pb-2">P95 (h)</th>
                  <th className="pb-2">Amostras</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.stageDurations.map((row) => (
                  <tr key={row.stage} className="border-b border-border/50">
                    <td className="py-2 flex items-center gap-2">
                      <Clock className="size-3 text-muted-foreground" />
                      {row.label}
                    </td>
                    <td className="py-2 font-mono">{row.medianHours}</td>
                    <td className="py-2 font-mono">{row.p95Hours}</td>
                    <td className="py-2 font-mono">{row.sampleSize}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Tendência custo de frete (6 meses)" subtitle="Média por pedido despachado">
        {isLoading ? (
          <div className="h-48 animate-pulse rounded-xl bg-muted/40" />
        ) : !dashboard?.monthlyShippingCosts?.length ? (
          <p className="text-sm text-muted-foreground">Sem dados de frete no período</p>
        ) : (
          <ShippingCostTrendChart
            data={dashboard.monthlyShippingCosts.map((r) => ({
              month: r.month,
              avgCost: r.avgCostCents,
              orders: r.orderCount,
            }))}
          />
        )}
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Custo por transportadora (30d)">
          {isLoading ? (
            <div className="h-24 animate-pulse rounded-xl bg-muted/40" />
          ) : !dashboard?.carrierCosts?.length ? (
            <p className="text-sm text-muted-foreground">Sem despachos no período</p>
          ) : (
            <div className="space-y-2">
              {dashboard.carrierCosts.map((row) => (
                <div
                  key={row.provider}
                  className="flex items-center justify-between border-b border-border/50 pb-2 text-sm"
                >
                  <span className="font-medium">{row.provider}</span>
                  <span className="font-mono text-muted-foreground">
                    {row.orderCount} ped. · média {formatBRL(row.avgCostCents / 100)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Volume por canal (30d)">
          {isLoading ? (
            <div className="h-24 animate-pulse rounded-xl bg-muted/40" />
          ) : !dashboard?.channelVolume?.length ? (
            <p className="text-sm text-muted-foreground">Sem pedidos no período</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                    <th className="pb-2">Canal</th>
                    <th className="pb-2">Pedidos</th>
                    <th className="pb-2">GMV</th>
                    <th className="pb-2">SLA</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.channelVolume.map((row) => (
                    <tr key={row.channel} className="border-b border-border/50">
                      <td className="py-2">{row.label}</td>
                      <td className="py-2 font-mono">{row.orderCount}</td>
                      <td className="py-2 font-mono">{formatBRL(row.gmvCents / 100, true)}</td>
                      <td className="py-2 font-mono">{row.slaCompliancePercent}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      <Panel title="Heat map de entregas (30d)" subtitle="Por cidade — entregues, em trânsito e incidentes">
        {loadingHeat ? (
          <div className="h-24 animate-pulse rounded-xl bg-muted/40" />
        ) : deliveryHeat.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem entregas no período</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                  <th className="pb-2">Cidade</th>
                  <th className="pb-2">UF</th>
                  <th className="pb-2">Entregues</th>
                  <th className="pb-2">Em trânsito</th>
                  <th className="pb-2">Incidentes</th>
                </tr>
              </thead>
              <tbody>
                {deliveryHeat.slice(0, 20).map((row) => (
                  <tr key={`${row.city}-${row.state}`} className="border-b border-border/50">
                    <td className="py-2 flex items-center gap-1">
                      <MapPin className="size-3 text-muted-foreground" />
                      {row.city}
                    </td>
                    <td className="py-2 font-mono">{row.state ?? "—"}</td>
                    <td className="py-2 font-mono text-success">{row.delivered}</td>
                    <td className="py-2 font-mono">{row.inTransit}</td>
                    <td className="py-2 font-mono text-warning">{row.incidents}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Ocorrências unificadas (30d)" subtitle="Incidentes, devoluções e quarentena">
        {loadingOccurrences ? (
          <div className="h-24 animate-pulse rounded-xl bg-muted/40" />
        ) : occurrences.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma ocorrência no período</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                  <th className="pb-2">Tipo</th>
                  <th className="pb-2">Descrição</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2">Data</th>
                </tr>
              </thead>
              <tbody>
                {occurrences.slice(0, 15).map((row) => (
                  <tr key={`${row.type}-${row.id}`} className="border-b border-border/50">
                    <td className="py-2 capitalize">{row.type}</td>
                    <td className="py-2 max-w-xs truncate">{row.title}</td>
                    <td className="py-2 font-mono">{row.status}</td>
                    <td className="py-2 font-mono text-xs">
                      {new Date(row.createdAt).toLocaleDateString("pt-BR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

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

      <Panel title="Ranking de operadores (30d)">
        {loadingOperators ? (
          <div className="h-24 animate-pulse rounded-xl bg-muted/40" />
        ) : operators.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem dados de operadores no período</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                  <th className="pb-2">Operador</th>
                  <th className="pb-2">Picks</th>
                  <th className="pb-2">Packs</th>
                  <th className="pb-2">Não encontrados</th>
                  <th className="pb-2">Picks/h</th>
                  <th className="pb-2">Acurácia</th>
                </tr>
              </thead>
              <tbody>
                {operators.map((row) => (
                  <tr key={row.operatorId} className="border-b border-border/50">
                    <td className="py-2">{row.operatorName}</td>
                    <td className="py-2 font-mono">{row.picksCompleted}</td>
                    <td className="py-2 font-mono">{row.packsCompleted}</td>
                    <td className="py-2 font-mono">{row.notFoundCount}</td>
                    <td className="py-2 font-mono">{row.picksPerHour}</td>
                    <td className="py-2 font-mono">{row.accuracyPercent}%</td>
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
