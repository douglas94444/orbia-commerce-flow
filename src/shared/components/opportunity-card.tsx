import { Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

export function OpportunityCard({
  title,
  potential,
  ctaLabel,
  onClick,
}: {
  title: string;
  potential: string;
  ctaLabel: string;
  onClick?: () => void;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-warning/20 bg-warning/5 p-4">
      <div className="rounded-md border border-warning/20 bg-warning/10 p-2">
        <Zap className="size-4 text-warning" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-foreground">{title}</p>
        <p className="text-metric mt-1 text-lg font-semibold text-primary">
          {potential} potencial
        </p>
      </div>
      <Button size="sm" variant="outline" onClick={onClick}>
        {ctaLabel}
      </Button>
    </div>
  );
}
