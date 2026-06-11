import {
  AlertTriangle,
  FileWarning,
  Gauge,
  PackageX,
  ShieldCheck,
  Timer,
  type LucideIcon,
} from "lucide-react";
import { useOperationAlerts } from "@/modules/analytics/hooks/use-analytics";
import type { AlertKind, AlertSeverity, OperationAlert } from "@/types/orbia";
import { cn } from "@/lib/utils";

const iconByKind: Record<AlertKind, LucideIcon> = {
  roas: Gauge,
  sla: Timer,
  fiscal: FileWarning,
  stock: PackageX,
  health: AlertTriangle,
  system: ShieldCheck,
};

const toneBySeverity: Record<
  AlertSeverity,
  { wrap: string; bar: string; text: string }
> = {
  critical: {
    wrap: "border-destructive/30 bg-destructive/[0.07]",
    bar: "bg-destructive",
    text: "text-destructive",
  },
  warning: {
    wrap: "border-warning/30 bg-warning/[0.06]",
    bar: "bg-warning",
    text: "text-warning",
  },
  info: {
    wrap: "border-border bg-muted/30",
    bar: "bg-muted-foreground/60",
    text: "text-muted-foreground",
  },
};

function AlertRow({ alert }: { alert: OperationAlert }) {
  const Icon = iconByKind[alert.kind];
  const tone = toneBySeverity[alert.severity];
  return (
    <div className={cn("relative overflow-hidden rounded-xl border p-3 pl-4 transition-opacity", tone.wrap)}>
      <span className={cn("absolute inset-y-0 left-0 w-0.5", tone.bar)} />
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className={cn("flex items-center gap-1.5 text-xs font-semibold", tone.text)}>
          <Icon className="size-3.5" />
          {alert.title}
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">{alert.time}</span>
      </div>
      <p className="text-xs leading-relaxed text-foreground/85">{alert.message}</p>
      <p className="mt-1 text-[10px] font-medium text-muted-foreground">{alert.client}</p>
    </div>
  );
}

export function AlertsPanel() {
  const { data: alerts = [], isLoading } = useOperationAlerts();
  const critical = alerts.filter((a) => a.severity === "critical").length;
  return (
    <aside className="hidden w-80 shrink-0 flex-col border-l border-border bg-sidebar/80 xl:flex">
      <div className="flex h-16 items-center justify-between border-b border-border px-5">
        <span className="text-label">Alertas críticos</span>
        <span className="grid size-6 place-items-center rounded-full bg-destructive/15 font-mono text-[10px] font-bold text-destructive">
          {critical}
        </span>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {isLoading ? (
          <div className="h-24 animate-pulse rounded-xl bg-muted/40" />
        ) : alerts.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted-foreground">Nenhum alerta ativo.</p>
        ) : (
          alerts.map((alert) => <AlertRow key={alert.id} alert={alert} />)
        )}
      </div>

      <div className="border-t border-border p-4">
        <div className="surface-card rounded-xl p-4">
          <p className="mb-3 text-xs font-medium text-muted-foreground">Status do sistema</p>
          <div className="mb-3 flex items-center gap-1.5">
            {[1, 1, 1, 0.3].map((v, i) => (
              <span
                key={i}
                className="h-1 flex-1 rounded-full"
                style={{ backgroundColor: `color-mix(in oklab, var(--primary) ${v * 100}%, var(--border))` }}
              />
            ))}
          </div>
          <p className="font-mono text-[10px] text-muted-foreground">
            LATÊNCIA 14ms · UPTIME 99,9% · ALERTAS &lt; 1min
          </p>
        </div>
      </div>
    </aside>
  );
}
