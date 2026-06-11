import { cn } from "@/shared/lib/utils";

export interface FunnelBarProps {
  label: string;
  value: number;
  max: number;
  dropRate?: number;
  isBottleneck?: boolean;
}

export function FunnelBar({ label, value, max, dropRate, isBottleneck }: FunnelBarProps) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;

  const dropClass =
    dropRate === undefined
      ? "text-muted-foreground"
      : dropRate > 0.7
        ? "text-severity-critical"
        : dropRate > 0.4
          ? "text-severity-high"
          : "text-severity-medium";

  return (
    <div className="grid grid-cols-1 items-center gap-2 py-2 sm:grid-cols-[minmax(0,140px)_1fr_minmax(0,100px)_minmax(0,120px)] sm:gap-3">
      <span className="text-sm text-foreground">{label}</span>
      <div className="h-8 overflow-hidden rounded-lg bg-muted">
        <div
          className={cn(
            "h-full rounded-lg transition-all duration-500",
            isBottleneck
              ? "bg-severity-critical animate-pulse-dot"
              : "bg-primary-gradient",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-metric text-right text-sm text-foreground sm:text-left">
        {value.toLocaleString("pt-BR")}
      </span>
      {dropRate !== undefined ? (
        <span className={cn("text-right text-sm", dropClass)}>
          ▼ {Math.round(dropRate * 100)}% saíram
        </span>
      ) : (
        <span className="hidden sm:block" />
      )}
    </div>
  );
}
