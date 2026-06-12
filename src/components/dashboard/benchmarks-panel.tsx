import { Loader2, TrendingUp } from "lucide-react";
import { Panel } from "@/components/dashboard/panel";
import { useBenchmarkSummary } from "@/modules/benchmarks/hooks/use-benchmarks";

export function BenchmarksPanel() {
  const { data: rows = [], isLoading } = useBenchmarkSummary();

  return (
    <Panel
      title="Benchmarks da carteira"
      subtitle="Comparativo com média e P75 do portfólio"
      action={<TrendingUp className="size-4 text-primary" />}
    >
      {isLoading ? (
        <div className="h-24 animate-pulse rounded-xl bg-muted/40" />
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Sem snapshots ainda — o cron capture-benchmarks popula esta tabela.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                <th className="pb-2">Métrica</th>
                <th className="pb-2">Cliente</th>
                <th className="pb-2">Média</th>
                <th className="pb-2">P75</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 12).map((row, idx) => {
                const clients = row.clients as { name: string } | null;
                return (
                  <tr key={idx} className="border-b border-border/50">
                    <td className="py-2 font-mono text-xs">{row.metric_key as string}</td>
                    <td className="py-2">{clients?.name ?? "—"}</td>
                    <td className="py-2 font-mono">{Number(row.value).toFixed(2)}</td>
                    <td className="py-2 font-mono text-muted-foreground">
                      μ {Number(row.portfolio_avg).toFixed(2)} · P75{" "}
                      {Number(row.portfolio_p75).toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
