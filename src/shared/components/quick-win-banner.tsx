import { useState } from "react";
import { Lightbulb, X } from "lucide-react";

export function QuickWinBanner({
  count,
  onView,
}: {
  count: number;
  onView?: () => void;
}) {
  const [visible, setVisible] = useState(true);
  if (!visible || count <= 0) return null;

  return (
    <div className="flex animate-fade-up items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
      <Lightbulb className="size-4 shrink-0 text-primary" />
      <p className="flex-1 text-sm">
        <strong className="text-primary">{count} oportunidades</strong> de receita esperando.{" "}
        {onView && (
          <button
            type="button"
            onClick={onView}
            className="text-primary underline underline-offset-2 hover:brightness-110"
          >
            Ver →
          </button>
        )}
      </p>
      <button
        type="button"
        onClick={() => setVisible(false)}
        className="text-muted-foreground transition-colors hover:text-foreground"
        aria-label="Fechar"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
