import { useEffect, useState } from "react";
import { type LucideIcon, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  label: string;
  value: string;
  delta?: { value: string; positive: boolean };
  hint?: string;
  icon: LucideIcon;
  accent?: "primary" | "accent" | "success" | "warning";
}

const accentMap = {
  primary: "text-primary",
  accent: "text-primary",
  success: "text-success",
  warning: "text-warning",
} as const;

const iconWellMap = {
  primary: "icon-well",
  accent: "icon-well",
  success: "border-success/20 bg-success/10 text-success",
  warning: "border-warning/20 bg-warning/10 text-warning",
} as const;

export function KpiCard({ label, value, delta, hint, icon: Icon, accent = "primary" }: KpiCardProps) {
  return (
    <div className="surface-elevated p-5 transition-colors duration-[180ms] hover:border-border-strong">
      <div className="mb-4 flex items-start justify-between gap-3">
        <p className="text-label">{label}</p>
        <span
          className={cn(
            "grid size-8 shrink-0 place-items-center rounded-lg border",
            iconWellMap[accent],
          )}
        >
          <Icon className="size-3.5" />
        </span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-metric text-2xl font-semibold text-foreground">{value}</span>
        {delta && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-[11px] font-semibold",
              delta.positive ? "text-success" : "text-destructive",
            )}
          >
            {delta.positive ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
            {delta.value}
          </span>
        )}
      </div>
      {hint && <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function useCountUp(target: number, duration = 900) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(target * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}
