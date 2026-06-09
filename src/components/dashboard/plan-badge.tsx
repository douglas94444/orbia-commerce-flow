import { cn } from "@/lib/utils";
import type { PlanTier } from "@/types/orbia";

const styles: Record<PlanTier, string> = {
  Launch: "border-border bg-muted/60 text-muted-foreground",
  Growth: "border-primary/40 bg-primary/10 text-primary",
  Scale: "border-accent/40 bg-accent/15 text-accent",
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
      {plan}
    </span>
  );
}
