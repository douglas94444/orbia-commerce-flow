import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Loader2, TrendingUp } from "lucide-react";
import { PageIntro, Panel } from "@/components/dashboard/panel";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/format";
import { useRunUpsellScan, useSalesFunnel, useSalesMetrics, useUpsellOpportunities } from "@/modules/sales/hooks/use-sales";

export const Route = createFileRoute("/_dashboard/sales/metrics")({
  head: () => ({ meta: [{ title: "Métricas de Vendas — Orbia" }] }),
  component: SalesMetricsPage,
});

function SalesMetricsPage() {
  const { data: metrics, isLoading } = useSalesMetrics();
  const { data: funnel = [] } = useSalesFunnel();
  const { data: upsells = [] } = useUpsellOpportunities();
  const runScan = useRunUpsellScan();

  if (isLoading || !metrics) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link to="/sales" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Pipeline
      </Link>

      <PageIntro
        eyebrow="Motor de Vendas"
        title="Métricas & forecast"
        description="MRR, conversão por canal, funil e oportunidades de upsell."
        action={
          <Button size="sm" variant="outline" onClick={() => runScan.mutate()} disabled={runScan.isPending}>
            Escanear upsells
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="MRR novo" value={formatBRL(metrics.newMrrCents / 100, true)} icon={TrendingUp} accent="primary" />
        <KpiCard label="MRR expandido" value={formatBRL(metrics.expandedMrrCents / 100, true)} accent="success" />
        <KpiCard label="MRR churned" value={formatBRL(metrics.churnedMrrCents / 100, true)} accent="warning" />
        <KpiCard label="Net MRR" value={formatBRL(metrics.netMrrCents / 100, true)} accent="accent" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel>
          <h3 className="font-display mb-4">Forecast pipeline</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span>30 dias</span><span className="font-mono">{formatBRL(metrics.forecast30dCents / 100, true)}</span></div>
            <div className="flex justify-between"><span>60 dias</span><span className="font-mono">{formatBRL(metrics.forecast60dCents / 100, true)}</span></div>
            <div className="flex justify-between"><span>90 dias</span><span className="font-mono">{formatBRL(metrics.forecast90dCents / 100, true)}</span></div>
          </div>
        </Panel>
        <Panel>
          <h3 className="font-display mb-4">Propostas</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span>Taxa visualização</span><span className="font-mono">{metrics.proposalViewRate}%</span></div>
            <div className="flex justify-between"><span>Taxa resposta</span><span className="font-mono">{metrics.proposalResponseRate}%</span></div>
          </div>
        </Panel>
        <Panel>
          <h3 className="font-display mb-4">Conversão por canal</h3>
          <div className="space-y-2 text-sm">
            {metrics.conversionBySource.map((c) => (
              <div key={c.source} className="flex justify-between">
                <span>{c.source}</span>
                <span className="font-mono">{c.rate}% ({c.converted}/{c.total})</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel>
        <h3 className="font-display mb-4">Funil por estágio</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {funnel.map((s) => (
            <div key={s.stage_key} className="rounded-lg bg-muted/30 p-3 text-center">
              <p className="text-xs text-muted-foreground truncate">{s.label}</p>
              <p className="font-mono text-xl">{s.prospect_count}</p>
              <p className="text-xs text-amber-400">{s.hot_count} quentes</p>
            </div>
          ))}
        </div>
      </Panel>

      {upsells.length > 0 && (
        <Panel>
          <h3 className="font-display mb-4">Oportunidades de upsell</h3>
          <div className="space-y-2">
            {upsells.map((u) => (
              <div key={u.id} className="flex justify-between text-sm border-b border-border/40 pb-2">
                <span>{(u.clients as { name?: string })?.name}</span>
                <span className="text-muted-foreground">{u.trigger_type} → {u.to_plan ?? u.module_key}</span>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}
