import { useEffect, useState } from "react";
import { motion } from "framer-motion";
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
  accent: "text-accent",
  success: "text-success",
  warning: "text-warning",
} as const;

export function KpiCard({ label, value, delta, hint, icon: Icon, accent = "primary" }: KpiCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="glass-panel group relative overflow-hidden rounded-2xl p-5"
    >
      <div
        className="pointer-events-none absolute -right-8 -top-8 size-24 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
        style={{ background: "color-mix(in oklab, var(--primary) 40%, transparent)" }}
      />
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </p>
        <Icon className={cn("size-4", accentMap[accent])} />
      </div>
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-2xl font-semibold tracking-tight text-foreground">
          {value}
        </span>
        {delta && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-[11px] font-semibold",
              delta.positive ? "text-success" : "text-destructive",
            )}
          >
            {delta.positive ? (
              <TrendingUp className="size-3" />
            ) : (
              <TrendingDown className="size-3" />
            )}
            {delta.value}
          </span>
        )}
      </div>
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </motion.div>
  );
}

/** Conta de 0 até target quando entra em vista. Retorna string formatada. */
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
