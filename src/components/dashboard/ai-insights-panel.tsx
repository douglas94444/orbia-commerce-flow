import { Loader2, Sparkles } from "lucide-react";
import { Panel } from "@/components/dashboard/panel";
import { useAiInsights } from "@/modules/analytics/hooks/use-analytics";
import { cn } from "@/shared/lib/utils";

const PRIORITY_CLASS = {
  high: "border-destructive/40 bg-destructive/5",
  medium: "border-warning/40 bg-warning/5",
  low: "border-border bg-card",
};

interface AiInsightsPanelProps {
  clientId?: string;
  title?: string;
}

export function AiInsightsPanel({ clientId, title = "Insights com IA" }: AiInsightsPanelProps) {
  const { data: insights = [], isLoading, isError } = useAiInsights(clientId);

  return (
    <Panel
      title={title}
      subtitle="Análise assistida por Claude — dados reais da operação"
      action={<Sparkles className="size-4 text-accent" />}
    >
      {isLoading ? (
        <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Gerando insights…
        </div>
      ) : isError ? (
        <p className="py-6 text-sm text-muted-foreground">
          Insights indisponíveis (configure ANTHROPIC_API_KEY no servidor).
        </p>
      ) : insights.length === 0 ? (
        <p className="py-6 text-sm text-muted-foreground">Nenhum insight gerado.</p>
      ) : (
        <div className="space-y-3">
          {insights.map((insight, idx) => (
            <div
              key={idx}
              className={cn(
                "rounded-xl border p-4",
                PRIORITY_CLASS[insight.priority] ?? PRIORITY_CLASS.low,
              )}
            >
              <p className="text-xs uppercase text-muted-foreground">{insight.category}</p>
              <p className="mt-1 font-medium">{insight.headline}</p>
              <p className="mt-1 text-sm text-muted-foreground">{insight.body}</p>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
