import { createFileRoute } from "@tanstack/react-router";
import { Gauge, Target, TrendingUp, Wallet } from "lucide-react";
import { PageIntro, Panel } from "@/components/dashboard/panel";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { ChannelRoasChart } from "@/components/dashboard/charts";
import { StatusPill } from "@/components/dashboard/status-pill";
import { campaigns } from "@/lib/mock/data";
import { formatBRL } from "@/lib/format";

export const Route = createFileRoute("/_dashboard/traffic")({
  head: () => ({ meta: [{ title: "Tráfego — Orbia" }] }),
  component: TrafficPage,
});

const campaignTone = { ativa: "success", atencao: "warning", pausada: "neutral" } as const;
const campaignLabel = { ativa: "Ativa", atencao: "Atenção", pausada: "Pausada" } as const;

function TrafficPage() {
  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Módulo Tráfego"
        title="Performance de mídia paga"
        description="ROAS por canal com atribuição multicanal e alertas automáticos quando o retorno cai abaixo do threshold."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="ROAS médio" value="5,4x" delta={{ value: "0,3x", positive: true }} icon={Gauge} accent="primary" />
        <KpiCard label="Investimento (30d)" value="R$ 271k" icon={Wallet} accent="accent" />
        <KpiCard label="Receita atribuída" value="R$ 1,46M" delta={{ value: "9,1%", positive: true }} icon={TrendingUp} accent="success" />
        <KpiCard label="Threshold crítico" value="4,0x" hint="Alerta automático abaixo disso" icon={Target} accent="warning" />
      </div>

      <Panel title="ROAS por canal" subtitle="Meta, Google, TikTok e orgânico">
        <ChannelRoasChart />
      </Panel>

      <Panel title="Campanhas em execução" subtitle="Diagnóstico assistido por IA">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="pb-3 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Campanha</th>
                <th className="pb-3 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Plataforma</th>
                <th className="pb-3 text-right text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Investido</th>
                <th className="pb-3 text-right text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Receita</th>
                <th className="pb-3 text-right text-[10px] font-medium uppercase tracking-wider text-muted-foreground">ROAS</th>
                <th className="pb-3 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {campaigns.map((c) => (
                <tr key={c.id} className="transition-colors hover:bg-muted/30">
                  <td className="py-3">
                    <p className="text-sm font-medium text-foreground">{c.name}</p>
                    <p className="text-[11px] text-muted-foreground">{c.client}</p>
                  </td>
                  <td className="py-3 text-sm text-muted-foreground">{c.platform}</td>
                  <td className="py-3 text-right font-mono text-sm text-foreground">{formatBRL(c.spend, true)}</td>
                  <td className="py-3 text-right font-mono text-sm text-foreground">{formatBRL(c.revenue, true)}</td>
                  <td className="py-3 text-right font-mono text-sm font-semibold" style={{ color: c.roas < 4 ? "var(--destructive)" : c.roas < 6 ? "var(--warning)" : "var(--success)" }}>
                    {c.roas.toFixed(1)}x
                  </td>
                  <td className="py-3">
                    <StatusPill label={campaignLabel[c.status]} tone={campaignTone[c.status]} dot />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
