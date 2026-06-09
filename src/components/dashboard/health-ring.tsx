import { cn } from "@/lib/utils";
import { healthStatus } from "@/lib/health";

const colorByStatus = {
  saudavel: "var(--success)",
  atencao: "var(--warning)",
  risco: "var(--destructive)",
} as const;

const labelByStatus = {
  saudavel: "Saudável",
  atencao: "Atenção",
  risco: "Risco",
} as const;

export function HealthRing({
  score,
  size = 44,
  showLabel = false,
  className,
}: {
  score: number;
  size?: number;
  showLabel?: boolean;
  className?: string;
}) {
  const status = healthStatus(score);
  const color = colorByStatus[status];
  const stroke = 4;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className={cn("inline-flex items-center gap-3", className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--border)"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 0.8s ease", filter: `drop-shadow(0 0 4px ${color})` }}
          />
        </svg>
        <span
          className="absolute inset-0 flex items-center justify-center font-mono text-xs font-semibold"
          style={{ color }}
        >
          {score}
        </span>
      </div>
      {showLabel && (
        <span className="text-xs font-medium" style={{ color }}>
          {labelByStatus[status]}
        </span>
      )}
    </div>
  );
}

export function HealthBadge({ score }: { score: number }) {
  const status = healthStatus(score);
  const color = colorByStatus[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
      style={{ borderColor: `color-mix(in oklab, ${color} 40%, transparent)`, color, backgroundColor: `color-mix(in oklab, ${color} 12%, transparent)` }}
    >
      <span className="size-1.5 rounded-full" style={{ backgroundColor: color }} />
      {labelByStatus[status]}
    </span>
  );
}
