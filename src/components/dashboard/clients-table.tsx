import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import type { Client } from "@/types/orbia";
import { PlanBadge } from "./plan-badge";
import { HealthRing } from "./health-ring";
import { formatBRL } from "@/lib/format";

export function ClientsTable({ data, compact = false }: { data: Client[]; compact?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="pb-3 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Cliente</th>
            <th className="pb-3 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Plano</th>
            {!compact && (
              <th className="pb-3 text-right text-[10px] font-medium uppercase tracking-wider text-muted-foreground">GMV (30d)</th>
            )}
            {!compact && (
              <th className="pb-3 text-right text-[10px] font-medium uppercase tracking-wider text-muted-foreground">ROAS</th>
            )}
            <th className="pb-3 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Health Score</th>
            <th className="pb-3 text-right text-[10px] font-medium uppercase tracking-wider text-muted-foreground" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {data.map((c) => (
            <tr key={c.id} className="group transition-colors hover:bg-muted/30">
              <td className="py-3">
                <div className="flex items-center gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-border bg-muted/50 font-mono text-[11px] font-semibold text-foreground">
                    {c.initials}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-foreground">{c.name}</p>
                    <p className="text-[11px] text-muted-foreground">{c.segment}</p>
                  </div>
                </div>
              </td>
              <td className="py-3">
                <PlanBadge plan={c.plan} />
              </td>
              {!compact && (
                <td className="py-3 text-right font-mono text-sm text-foreground">{formatBRL(c.gmv30d, true)}</td>
              )}
              {!compact && (
                <td className="py-3 text-right font-mono text-sm text-primary">{c.roas.toFixed(1)}x</td>
              )}
              <td className="py-3">
                <HealthRing score={c.healthScore} size={36} />
              </td>
              <td className="py-3 text-right">
                <Link
                  to="/clients/$id"
                  params={{ id: c.id }}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground opacity-0 transition-opacity hover:text-primary group-hover:opacity-100"
                >
                  Detalhes <ArrowUpRight className="size-3" />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
