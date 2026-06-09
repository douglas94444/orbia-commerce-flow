import { cn } from "@/lib/utils";
import type { PlanTier } from "@/types/orbia";

const styles: Record<PlanTier, string> = {
  launch: "border-border bg-muted/60 text-muted-foreground",
  growth: "border-primary/40 bg-primary/10 text-primary",
  scale: "border-accent/40 bg-accent/15 text-accent",
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
        "inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider",
        styles[plan],
        className,
      )}
    >
      {labels[plan]}
    </span>
  );
}
