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
            <th className="text-label pb-3">Cliente</th>
            <th className="text-label pb-3">Plano</th>
            {!compact && <th className="text-label pb-3 text-right">GMV (30d)</th>}
            {!compact && <th className="text-label pb-3 text-right">ROAS</th>}
            <th className="text-label pb-3">Health Score</th>
            <th className="text-label pb-3 text-right" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {data.map((c) => (
            <tr key={c.id} className="group transition-colors duration-[180ms] hover:bg-muted/40">
              <td className="py-3">
                <div className="flex items-center gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-border-strong bg-muted/30 font-mono text-[11px] font-medium text-foreground">
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
