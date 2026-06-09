import { createFileRoute } from "@tanstack/react-router";
import { BarChart3, Coins, Gauge, Percent, Truck } from "lucide-react";
import { PageIntro, Panel } from "@/components/dashboard/panel";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { GmvRoasChart, ChannelRoasChart } from "@/components/dashboard/charts";
import { cohortRetention } from "@/lib/mock/data";

export const Route = createFileRoute("/_dashboard/analytics")({
  head: () => ({ meta: [{ title: "Analytics — Orbia" }] }),
  component: AnalyticsPage,
});

function cohortColor(value: number) {
  if (value === 0) return "var(--muted)";
  return `color-mix(in oklab, var(--primary) ${value}%, var(--muted))`;
}

function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Analytics 360"
        title="Dados cruzados da operação"
        description="Visão consolidada de GMV, ROAS, LTV, SLA e margem real — agregados nativamente de todos os módulos."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <KpiCard label="GMV (30d)" value="R$ 3,1M" delta={{ value: "14%", positive: true }} icon={Coins} accent="primary" />
        <KpiCard label="ROAS médio" value="5,4x" icon={Gauge} accent="accent" />
        <KpiCard label="LTV médio" value="R$ 412" delta={{ value: "6,8%", positive: true }} icon={BarChart3} accent="success" />
        <KpiCard label="SLA entrega" value="98,2%" icon={Truck} accent="success" />
        <KpiCard label="Margem real" value="23,4%" delta={{ value: "1,2%", positive: true }} icon={Percent} accent="warning" />
      </div>

      <Panel title="GMV vs ROAS" subtitle="Tendência consolidada — 30 dias">
        <GmvRoasChart />
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="ROAS por canal">
          <ChannelRoasChart />
        </Panel>

        <Panel title="Retenção por cohort" subtitle="% de clientes ativos por mês">
          <div className="overflow-x-auto">
            <table className="w-full border-separate border-spacing-1">
              <thead>
                <tr className="text-left">
                  <th className="px-2 pb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Cohort</th>
                  {["M0", "M1", "M2", "M3"].map((m) => (
                    <th key={m} className="px-2 pb-2 text-center text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{m}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cohortRetention.map((row) => (
                  <tr key={row.month}>
                    <td className="px-2 py-1 text-xs font-medium text-foreground">{row.month}</td>
                    {[row.m0, row.m1, row.m2, row.m3].map((v, i) => (
                      <td key={i} className="px-1 py-1">
                        <div
                          className="grid h-9 place-items-center rounded-md font-mono text-[11px] font-semibold"
                          style={{
                            backgroundColor: cohortColor(v),
                            color: v > 55 ? "var(--primary-foreground)" : v === 0 ? "var(--muted-foreground)" : "var(--foreground)",
                          }}
                        >
                          {v === 0 ? "—" : `${v}%`}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  );
}
