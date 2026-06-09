import { createFileRoute } from "@tanstack/react-router";
import { CalendarClock, Smile, Target, TrendingUp } from "lucide-react";
import { PageIntro, Panel } from "@/components/dashboard/panel";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { PlanBadge } from "@/components/dashboard/plan-badge";
import { StatusPill, type Tone } from "@/components/dashboard/status-pill";
import { clients } from "@/lib/mock/data";

export const Route = createFileRoute("/_dashboard/success")({
  head: () => ({ meta: [{ title: "Customer Success — Orbia" }] }),
  component: SuccessPage,
});

const pipeline: { stage: string; tone: Tone; deals: { name: string; plan: "Launch" | "Growth" | "Scale"; value: string }[] }[] = [
  {
    stage: "Diagnóstico",
    tone: "primary",
    deals: [
      { name: "Moda Prime", plan: "Growth", value: "R$ 9k/mês" },
      { name: "ZenHome", plan: "Launch", value: "R$ 3,5k/mês" },
    ],
  },
  {
    stage: "Proposta",
    tone: "accent",
    deals: [
      { name: "Atletica Co.", plan: "Scale", value: "R$ 18k/mês" },
      { name: "Doce Lar", plan: "Growth", value: "R$ 9k/mês" },
    ],
  },
  {
    stage: "Onboarding",
    tone: "warning",
    deals: [
      { name: "PetClub", plan: "Launch", value: "Semana 2" },
      { name: "Gourmet Express", plan: "Launch", value: "Semana 3" },
    ],
  },
  {
    stage: "Ativo",
    tone: "success",
    deals: [
      { name: "Livraria Aurora", plan: "Scale", value: "QBR em 12d" },
      { name: "VeloBike", plan: "Scale", value: "QBR em 20d" },
    ],
  },
];

function SuccessPage() {
  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Customer Success"
        title="Relacionamento & expansão"
        description="Pipeline de vendas, tracker de onboarding de 30 dias, NPS e QBRs estratégicas da carteira."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="NPS" value="64" delta={{ value: "4 pts", positive: true }} hint="Meta: > 60" icon={Smile} accent="success" />
        <KpiCard label="Churn mensal" value="1,8%" delta={{ value: "0,3%", positive: true }} hint="Meta: < 2%" icon={Target} accent="primary" />
        <KpiCard label="QBRs este mês" value="6" icon={CalendarClock} accent="accent" />
        <KpiCard label="Expansão (upsell)" value="R$ 42k" delta={{ value: "18%", positive: true }} icon={TrendingUp} accent="warning" />
      </div>

      <Panel title="Pipeline de clientes" subtitle="Da prospecção à conta ativa">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {pipeline.map((col) => (
            <div key={col.stage} className="rounded-xl border border-border bg-muted/20 p-3">
              <div className="mb-3 flex items-center justify-between">
                <StatusPill label={col.stage} tone={col.tone} />
                <span className="font-mono text-[10px] text-muted-foreground">{col.deals.length}</span>
              </div>
              <div className="space-y-2">
                {col.deals.map((d) => (
                  <div key={d.name} className="rounded-lg border border-border bg-card/60 p-3">
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium text-foreground">{d.name}</p>
                      <PlanBadge plan={d.plan} />
                    </div>
                    <p className="text-[11px] text-muted-foreground">{d.value}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Tracker de onboarding (30 dias)" subtitle="Clientes em implantação">
        <div className="space-y-4">
          {clients
            .filter((c) => c.onboardingStage < 4)
            .map((c) => (
              <div key={c.id} className="rounded-xl border border-border bg-muted/20 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="grid size-8 place-items-center rounded-lg border border-border bg-muted/50 font-mono text-[11px] font-semibold">
                      {c.initials}
                    </span>
                    <p className="text-sm font-medium text-foreground">{c.name}</p>
                  </div>
                  <span className="font-mono text-xs text-muted-foreground">Semana {c.onboardingStage}/4</span>
                </div>
                <div className="flex gap-2">
                  {[1, 2, 3, 4].map((w) => (
                    <div
                      key={w}
                      className="h-1.5 flex-1 rounded-full"
                      style={{
                        backgroundColor:
                          w <= c.onboardingStage
                            ? "var(--primary)"
                            : "var(--border)",
                        boxShadow: w <= c.onboardingStage ? "0 0 8px var(--primary)" : "none",
                      }}
                    />
                  ))}
                </div>
                <div className="mt-2 flex justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
                  <span>Setup</span>
                  <span>Tráfego</span>
                  <span>Logística</span>
                  <span>Retenção</span>
                </div>
              </div>
            ))}
        </div>
      </Panel>
    </div>
  );
}
