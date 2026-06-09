import { createFileRoute } from "@tanstack/react-router";
import { Mail, MessageSquare, Repeat, Smartphone, TrendingUp, Users } from "lucide-react";
import { PageIntro, Panel } from "@/components/dashboard/panel";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { StatusPill } from "@/components/dashboard/status-pill";
import { automations } from "@/lib/mock/data";
import { formatNumber } from "@/lib/format";

export const Route = createFileRoute("/_dashboard/retention")({
  head: () => ({ meta: [{ title: "Retenção — Orbia" }] }),
  component: RetentionPage,
});

const channelIcon = { Email: Mail, SMS: Smartphone, WhatsApp: MessageSquare } as const;

const rfm = [
  { label: "Campeões", count: 1240, tone: "success" as const, desc: "Compram muito e recente" },
  { label: "Fiéis", count: 2180, tone: "primary" as const, desc: "Frequência alta" },
  { label: "Em risco", count: 860, tone: "warning" as const, desc: "Recência caindo" },
  { label: "Hibernando", count: 540, tone: "danger" as const, desc: "Sem compra 90d+" },
];

function RetentionPage() {
  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Módulo Retenção"
        title="Automações & LTV"
        description="Fluxos disparados por eventos nativos (pedido entregue, carrinho abandonado) e segmentação RFM em tempo real."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="LTV médio" value="R$ 412" delta={{ value: "6,8%", positive: true }} icon={TrendingUp} accent="primary" />
        <KpiCard label="Receita recuperada" value="R$ 184k" delta={{ value: "11%", positive: true }} icon={Repeat} accent="success" />
        <KpiCard label="Disparos (30d)" value="8,9k" icon={Mail} accent="accent" />
        <KpiCard label="Base segmentada" value="4,8k" hint="Perfis unificados" icon={Users} accent="warning" />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Panel title="Fluxos de automação" className="lg:col-span-3">
          <div className="space-y-3">
            {automations.map((a) => {
              const Icon = channelIcon[a.channel];
              return (
                <div key={a.id} className="flex items-center gap-4 rounded-xl border border-border bg-muted/20 p-4">
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{a.name}</p>
                    <p className="text-[11px] text-muted-foreground">Gatilho: {a.trigger} · {a.channel}</p>
                  </div>
                  <div className="hidden text-right sm:block">
                    <p className="font-mono text-sm text-foreground">{formatNumber(a.sent30d)}</p>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">disparos</p>
                  </div>
                  <StatusPill label={a.active ? "Ativo" : "Pausado"} tone={a.active ? "success" : "neutral"} dot />
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel title="Segmentação RFM" subtitle="Recência · Frequência · Valor" className="lg:col-span-2">
          <div className="grid grid-cols-2 gap-3">
            {rfm.map((s) => (
              <div key={s.label} className="rounded-xl border border-border bg-muted/20 p-4">
                <StatusPill label={s.label} tone={s.tone} />
                <p className="mt-3 font-mono text-xl font-semibold text-foreground">{formatNumber(s.count)}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
