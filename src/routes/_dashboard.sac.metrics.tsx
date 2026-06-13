import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { PageIntro, Panel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";
import { useSacMetrics, useSacReviewSummary } from "@/modules/sac/hooks/use-sac";

export const Route = createFileRoute("/_dashboard/sac/metrics")({
  head: () => ({ meta: [{ title: "Métricas SAC — Orbia" }] }),
  component: SacMetricsPage,
});

function SacMetricsPage() {
  const { data: metrics, isLoading } = useSacMetrics(30);
  const { data: reviews } = useSacReviewSummary();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/sac"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <PageIntro eyebrow="Relatórios" title="Métricas SAC" description="TMA, TMR, FCR, CSAT e volume por canal." />
      </div>

      {isLoading || !metrics ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="Tickets (30d)" value={String(metrics.totalTickets)} />
            <MetricCard label="Em aberto" value={String(metrics.openTickets)} />
            <MetricCard label="TMR médio" value={metrics.avgTmrMinutes != null ? `${metrics.avgTmrMinutes}min` : "—"} />
            <MetricCard label="TMA médio" value={metrics.avgTmaMinutes != null ? `${metrics.avgTmaMinutes}min` : "—"} />
            <MetricCard label="SLA cumprido" value={`${metrics.slaMetPercent}%`} />
            <MetricCard label="FCR" value={`${metrics.fcrPercent}%`} />
            <MetricCard label="CSAT médio" value={metrics.csatAvg != null ? String(metrics.csatAvg) : "—"} />
            <MetricCard label="Sentimento neg." value={String(metrics.negativeSentiment)} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel>
              <h3 className="font-display font-semibold mb-3">Por canal</h3>
              {metrics.byChannel.map((c) => (
                <div key={c.channel} className="flex justify-between py-1 text-sm">
                  <span className="capitalize">{c.channel}</span>
                  <span className="font-mono">{c.count}</span>
                </div>
              ))}
            </Panel>
            <Panel>
              <h3 className="font-display font-semibold mb-3">Por categoria</h3>
              {metrics.byCategory.map((c) => (
                <div key={c.category} className="flex justify-between py-1 text-sm">
                  <span className="capitalize">{c.category}</span>
                  <span className="font-mono">{c.count}</span>
                </div>
              ))}
            </Panel>
          </div>

          {reviews && (
            <Panel>
              <h3 className="font-display font-semibold mb-2">Avaliações</h3>
              <p className="text-sm text-muted-foreground">
                Média {reviews.avgRating} · {reviews.negativeCount} negativas recentes
              </p>
            </Panel>
          )}
        </>
      )}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface-elevated rounded-xl p-4">
      <p className="text-label text-xs">{label}</p>
      <p className="font-mono text-2xl font-semibold mt-1">{value}</p>
    </div>
  );
}
