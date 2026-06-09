import { AnimatePresence, motion } from "framer-motion";
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

function AlertRow({ alert, index }: { alert: OperationAlert; index: number }) {
  const Icon = iconByKind[alert.kind];
  const tone = toneBySeverity[alert.severity];
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 16 }}
      transition={{ duration: 0.3, delay: index * 0.03 }}
      className={cn("relative overflow-hidden rounded-xl border p-3 pl-4", tone.wrap)}
    >
      <span className={cn("absolute inset-y-0 left-0 w-0.5", tone.bar)} />
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className={cn("flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider", tone.text)}>
          <Icon className="size-3.5" />
          {alert.title}
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">{alert.time}</span>
      </div>
      <p className="text-xs leading-relaxed text-foreground/85">{alert.message}</p>
      <p className="mt-1 text-[10px] font-medium text-muted-foreground">{alert.client}</p>
    </motion.div>
  );
}

export function AlertsPanel() {
  const { data: alerts = [], isLoading } = useOperationAlerts();
  const critical = alerts.filter((a) => a.severity === "critical").length;
  return (
    <aside className="hidden w-80 shrink-0 flex-col border-l border-border bg-sidebar/40 xl:flex">
      <div className="flex h-16 items-center justify-between border-b border-border px-5">
        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Alertas críticos
        </span>
        <span className="relative flex items-center">
          <span className="grid size-6 place-items-center rounded-full bg-destructive/15 font-mono text-[10px] font-bold text-destructive animate-pulse-ring">
            {critical}
          </span>
        </span>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {isLoading ? (
          <div className="h-24 animate-pulse rounded-xl bg-muted/40" />
        ) : alerts.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted-foreground">Nenhum alerta ativo.</p>
        ) : (
          <AnimatePresence initial={false}>
            {alerts.map((alert, i) => (
              <AlertRow key={alert.id} alert={alert} index={i} />
            ))}
          </AnimatePresence>
        )}
      </div>

      <div className="border-t border-border p-4">
        <div className="rounded-xl bg-card/80 p-4">
          <p className="mb-3 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Status do sistema
          </p>
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
