import { cn } from "@/lib/utils";
import type { PlanTier } from "@/types/orbia";

const styles: Record<PlanTier, string> = {
  launch: "border-border bg-muted/50 text-muted-foreground",
  growth: "border-primary/30 bg-primary/10 text-primary",
  scale: "border-success/30 bg-success/10 text-success",
};

const labels: Record<PlanTier, string> = {
  launch: "Launch",
  growth: "Growth",
  scale: "Scale",
};

export function PlanBadge({ plan, className }: { plan: PlanTier; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 font-mono text-[10px] font-medium tracking-wide",
        styles[plan],
        className,
      )}
    >
      {labels[plan]}
    </span>
  );
}
