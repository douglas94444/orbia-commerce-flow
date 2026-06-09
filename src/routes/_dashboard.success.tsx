import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  HeartPulse,
  Loader2,
  Smile,
  Users,
} from "lucide-react";
import { PageIntro, Panel } from "@/components/dashboard/panel";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { PlanBadge } from "@/components/dashboard/plan-badge";
import { StatusPill } from "@/components/dashboard/status-pill";
import { Button } from "@/components/ui/button";
import {
  useAtRiskClients,
  useOnboardingPipeline,
  useResolveOperationAlert,
  useSuccessPortfolio,
} from "@/modules/admin/hooks/use-admin";
import { useOperationAlerts } from "@/modules/analytics/hooks/use-analytics";
import type { PlanTier } from "@/types/orbia";

export const Route = createFileRoute("/_dashboard/success")({
  head: () => ({ meta: [{ title: "Customer Success — Orbia" }] }),
  component: SuccessPage,
});

function SuccessPage() {
  const { data: portfolio, isLoading: loadingPortfolio } = useSuccessPortfolio();
  const { data: pipeline = [], isLoading: loadingPipeline } = useOnboardingPipeline();
  const { data: atRisk = [], isLoading: loadingAtRisk } = useAtRiskClients();
  const { data: alerts = [], isLoading: loadingAlerts } = useOperationAlerts();
  const resolveAlert = useResolveOperationAlert();

  const loading = loadingPortfolio || loadingPipeline;

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Customer Success"
        title="Relacionamento & expansão"
        description="Carteira ativa, onboarding, NPS, QBRs e triagem de alertas operacionais."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label="NPS (90d)"
          value={loadingPortfolio ? "—" : portfolio?.avgNps90d != null ? String(portfolio.avgNps90d) : "—"}
          hint="Média das avaliações registradas"
          icon={Smile}
          accent="success"
        />
        <KpiCard
          label="Health médio"
          value={loadingPortfolio ? "—" : `${portfolio?.avgHealth ?? 0}/100`}
          hint="Carteira ativa"
          icon={HeartPulse}
          accent="primary"
        />
        <KpiCard
          label="QBRs (14d)"
          value={loadingPortfolio ? "—" : String(portfolio?.qbrsNext14d ?? 0)}
          hint="Agendadas nos próximos 14 dias"
          icon={CalendarClock}
          accent="accent"
        />
        <KpiCard
          label="Sem contato >14d"
          value={loadingPortfolio ? "—" : String(portfolio?.staleContactClients ?? 0)}
          hint={`${portfolio?.criticalAlerts ?? 0} alertas críticos abertos`}
          icon={Users}
          accent="warning"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Panel title="Pipeline de onboarding" subtitle="Clientes em implantação (semanas 1–3)">
            {loading ? (
              <div className="h-32 animate-pulse rounded-xl bg-muted/40" />
            ) : pipeline.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum cliente em onboarding ativo.
              </p>
            ) : (
              <div className="space-y-4">
                {pipeline.map((item) => (
                  <div
                    key={item.clientId}
                    className="rounded-xl border border-border bg-muted/20 p-4"
                  >
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <Link
                          to="/clients/$id"
                          params={{ id: item.clientId }}
                          className="text-sm font-medium text-foreground hover:text-primary"
                        >
                          {item.clientName}
                        </Link>
                        <PlanBadge plan={item.plan as PlanTier} />
                      </div>
                      <span className="font-mono text-xs text-muted-foreground">
                        Semana {item.onboardingWeek}/4 · {item.progressPercent}%
                      </span>
                    </div>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4].map((w) => (
                        <div
                          key={w}
                          className="h-1.5 flex-1 rounded-full"
                          style={{
                            backgroundColor:
                              w < item.onboardingWeek
                                ? "var(--primary)"
                                : w === item.onboardingWeek
                                  ? "var(--accent)"
                                  : "var(--border)",
                            boxShadow:
                              w <= item.onboardingWeek ? "0 0 8px var(--primary)" : "none",
                          }}
                        />
                      ))}
                    </div>
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      {item.tasksDone}/{item.tasksTotal} tarefas da semana atual concluídas
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Clientes em risco" subtitle="Health score abaixo de 50">
            {loadingAtRisk ? (
              <div className="h-24 animate-pulse rounded-xl bg-muted/40" />
            ) : atRisk.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum cliente em risco no momento.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border text-left">
                      {["Cliente", "Plano", "Health", "Último contato", ""].map((h) => (
                        <th
                          key={h}
                          className="pb-3 text-[10px] font-medium uppercase tracking-wider text-muted-foreground"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {atRisk.map((c) => (
                      <tr key={c.id} className="transition-colors hover:bg-muted/30">
                        <td className="py-2.5 text-sm font-medium text-foreground">{c.name}</td>
                        <td className="py-2.5">
                          <PlanBadge plan={c.plan as PlanTier} />
                        </td>
                        <td className="py-2.5">
                          <StatusPill
                            label={`${c.healthScore ?? 0}`}
                            tone="danger"
                            dot
                          />
                        </td>
                        <td className="py-2.5 font-mono text-xs text-muted-foreground">
                          {c.lastContactDays != null ? `${c.lastContactDays}d` : "—"}
                        </td>
                        <td className="py-2.5 text-right">
                          <Link
                            to="/clients/$id"
                            params={{ id: c.id }}
                            className="text-xs text-primary hover:underline"
                          >
                            Ver detalhe
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>

        <Panel
          title="Alertas operacionais"
          subtitle="Triage CS"
          action={<AlertTriangle className="size-4 text-muted-foreground" />}
        >
          {loadingAlerts ? (
            <div className="h-32 animate-pulse rounded-xl bg-muted/40" />
          ) : alerts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum alerta aberto.</p>
          ) : (
            <ul className="space-y-3">
              {alerts.map((alert) => (
                <li
                  key={alert.id}
                  className="rounded-lg border border-border bg-muted/20 p-3"
                >
                  <div className="mb-1 flex items-start justify-between gap-2">
                    <StatusPill
                      label={alert.severity}
                      tone={
                        alert.severity === "critical"
                          ? "danger"
                          : alert.severity === "warning"
                            ? "warning"
                            : "neutral"
                      }
                      dot
                    />
                    <span className="font-mono text-[10px] text-muted-foreground">{alert.time}</span>
                  </div>
                  <p className="text-sm font-medium text-foreground">{alert.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{alert.client}</p>
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{alert.message}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2 h-7 gap-1 text-xs"
                    disabled={resolveAlert.isPending}
                    onClick={() => resolveAlert.mutate(alert.id)}
                  >
                    {resolveAlert.isPending ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <CheckCircle2 className="size-3" />
                    )}
                    Resolver
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
