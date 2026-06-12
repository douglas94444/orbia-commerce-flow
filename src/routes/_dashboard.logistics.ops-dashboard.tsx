import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Activity, AlertTriangle, Package, ScanLine, Send, Truck } from "lucide-react";
import { PageIntro, Panel } from "@/components/dashboard/panel";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { Button } from "@/components/ui/button";
import { useOpsLiveDashboard } from "@/modules/logistics/hooks/use-fulfillly";
import {
  getSlaBucket,
  SLA_BUCKET_CLASS,
  SLA_BUCKET_LABEL,
} from "@/modules/logistics/ops-pwa/sla-bucket";
import { cn } from "@/shared/lib/utils";

export const Route = createFileRoute("/_dashboard/logistics/ops-dashboard")({
  head: () => ({ meta: [{ title: "Ops ao vivo — Orbia" }] }),
  component: OpsLiveDashboardPage,
});

function OpsLiveDashboardPage() {
  const { data, isLoading } = useOpsLiveDashboard();

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Fulfillly"
        title="Operações ao vivo"
        description="Fila de picking, despacho, SLA e ocorrências — atualização a cada 15s."
        action={<Activity className="size-5 text-primary animate-pulse" />}
      />

      <Link to="/logistics">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="mr-2 size-4" />
          Voltar à logística
        </Button>
      </Link>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <KpiCard
          label="Fila picking"
          value={isLoading ? "—" : String(data?.pickQueueSize ?? 0)}
          icon={ScanLine}
          accent="primary"
        />
        <KpiCard
          label="Urgente SLA"
          value={isLoading ? "—" : String(data?.pickUrgentCount ?? 0)}
          hint="≤ 6h para deadline"
          icon={AlertTriangle}
          accent="warning"
        />
        <KpiCard
          label="Despacho"
          value={isLoading ? "—" : String(data?.dispatchQueueSize ?? 0)}
          icon={Send}
          accent="accent"
        />
        <KpiCard
          label="Incidentes abertos"
          value={isLoading ? "—" : String(data?.openIncidents ?? 0)}
          icon={Truck}
          accent="warning"
        />
        <KpiCard
          label="SLA em risco"
          value={
            isLoading
              ? "—"
              : `${(data?.slaAtRisk ?? 0) + (data?.slaBreached ?? 0)}`
          }
          hint={`${data?.slaBreached ?? 0} estourados`}
          icon={Package}
          accent="warning"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Próximos picks" subtitle="Ordenados por SLA">
          {isLoading ? (
            <div className="h-32 animate-pulse rounded-xl bg-muted/40" />
          ) : !data?.pickLines?.length ? (
            <p className="text-sm text-muted-foreground">Fila vazia</p>
          ) : (
            <div className="space-y-2">
              {data.pickLines.map((line) => {
                const bucket = getSlaBucket(line.slaDeadlineAt);
                return (
                  <div
                    key={line.lineId}
                    className="flex items-center justify-between rounded-lg border border-border p-3 text-sm"
                  >
                    <div>
                      <p className="font-mono font-medium">{line.sku}</p>
                      <p className="text-xs text-muted-foreground">
                        {line.orderExternalId} · qtd {line.qtyRequired}
                      </p>
                    </div>
                    {line.slaDeadlineAt && (
                      <span className={cn("text-xs font-medium", SLA_BUCKET_CLASS[bucket])}>
                        {SLA_BUCKET_LABEL[bucket]}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        <Panel title="Progresso por pedido">
          {isLoading ? (
            <div className="h-32 animate-pulse rounded-xl bg-muted/40" />
          ) : !data?.orderProgress?.length ? (
            <p className="text-sm text-muted-foreground">Sem tarefas ativas</p>
          ) : (
            <div className="space-y-2">
              {data.orderProgress.map((o) => (
                <div
                  key={o.taskId}
                  className="flex items-center justify-between rounded-lg border border-border p-3 text-sm"
                >
                  <span className="font-mono">{o.orderExternalId}</span>
                  <span className="font-mono text-primary">
                    {o.pickedCount}/{o.totalCount}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <div className="flex gap-2">
        <Link to="/ops/picking">
          <Button size="sm">Abrir picking</Button>
        </Link>
        <Link to="/ops/dispatch">
          <Button size="sm" variant="outline">
            Abrir despacho
          </Button>
        </Link>
      </div>
    </div>
  );
}
