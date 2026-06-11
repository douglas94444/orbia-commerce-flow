import { cn } from "@/shared/lib/utils";
import { SEVERITY_STYLES, type SeverityLevel } from "@/shared/lib/design-tokens";

export function SeverityBadge({
  severity,
  className,
}: {
  severity: SeverityLevel;
  className?: string;
}) {
  const config = SEVERITY_STYLES[severity];

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-medium uppercase tracking-wide",
        config.className,
        config.pulse && "animate-pulse-dot",
        className,
      )}
    >
      {config.label}
    </span>
  );
}
