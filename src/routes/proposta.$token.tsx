import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatBRL } from "@/lib/format";
import { PLAN_LABELS, PLAN_PRICES_CENTS, type PlanTier } from "@/shared/constants/plans";
import { usePublicProposal, useTrackProposalSection } from "@/modules/sales/hooks/use-sales";

export const Route = createFileRoute("/proposta/$token")({
  head: () => ({ meta: [{ title: "Proposta — Orbia" }] }),
  component: PropostaPage,
});

function PropostaPage() {
  const { token } = Route.useParams();
  const { data, isLoading } = usePublicProposal(token);
  const track = useTrackProposalSection();
  const sectionTimers = useRef<Map<string, number>>(new Map());

  const [roiGrowth, setRoiGrowth] = useState(15);
  const [roiRevenue, setRoiRevenue] = useState(100_000);

  useEffect(() => {
    if (!data) return;
    const roi = data.roiParams as { projectedGrowthPct?: number; currentRevenueCents?: number };
    setRoiGrowth(roi.projectedGrowthPct ?? 15);
    setRoiRevenue((roi.currentRevenueCents ?? 0) / 100);
  }, [data]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const key = entry.target.id;
          if (entry.isIntersecting) {
            sectionTimers.current.set(key, Date.now());
          } else {
            const start = sectionTimers.current.get(key);
            if (start) {
              track.mutate({ token, sectionKey: key, durationMs: Date.now() - start });
              sectionTimers.current.delete(key);
            }
          }
        }
      },
      { threshold: 0.5 },
    );
    document.querySelectorAll("[data-section]").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [data, token]);

  if (isLoading || !data) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;
  }

  const content = data.content as {
    headline?: string;
    diagnosisSummary?: string;
    planJustification?: string;
    successCases?: Array<{ name: string; result: string }>;
    faq?: Array<{ q: string; a: string }>;
  };

  const validUntil = new Date(data.validUntil);
  const daysLeft = Math.max(0, Math.ceil((validUntil.getTime() - Date.now()) / 86400000));
  const recommended = data.recommendedPlan as PlanTier;
  const projected = roiRevenue * (1 + roiGrowth / 100);
  const investment = PLAN_PRICES_CENTS[recommended] / 100;

  const plans: PlanTier[] = ["launch", "growth", "scale"];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-6 py-4 flex justify-between items-center">
        <span className="font-bold">Orbia</span>
        {daysLeft > 0 && (
          <span className="text-sm text-amber-400 font-mono">Válida por {daysLeft} dias</span>
        )}
      </header>

      <div className="mx-auto max-w-4xl px-6 py-12 space-y-12">
        <section id="hero" data-section>
          <h1 className="font-display text-4xl font-bold">{content.headline}</h1>
          <p className="mt-4 text-muted-foreground text-lg">{content.diagnosisSummary}</p>
        </section>

        <section id="roi" data-section className="rounded-xl border border-primary/30 bg-primary/5 p-6">
          <h2 className="font-display text-xl font-bold mb-4">Calculadora de ROI</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm">
              Faturamento atual (R$)
              <input type="number" className="mt-1 w-full rounded-lg border bg-card px-3 py-2" value={roiRevenue} onChange={(e) => setRoiRevenue(Number(e.target.value))} />
            </label>
            <label className="text-sm">
              Crescimento esperado (%)
              <input type="range" min={5} max={45} className="mt-2 w-full" value={roiGrowth} onChange={(e) => setRoiGrowth(Number(e.target.value))} />
              <span className="font-mono">{roiGrowth}%</span>
            </label>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-4 text-center">
            <div><p className="text-xs text-muted-foreground">Projeção</p><p className="font-mono text-xl">{formatBRL(projected)}</p></div>
            <div><p className="text-xs text-muted-foreground">Investimento</p><p className="font-mono text-xl">{formatBRL(investment)}</p></div>
            <div><p className="text-xs text-muted-foreground">Retorno líquido</p><p className="font-mono text-xl text-primary">{formatBRL(projected - roiRevenue - investment)}</p></div>
          </div>
        </section>

        <section id="plans" data-section>
          <h2 className="font-display text-xl font-bold mb-6">Planos</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {plans.map((plan) => (
              <div key={plan} className={cn("rounded-xl border p-5", plan === recommended && "border-primary ring-2 ring-primary/30")}>
                {plan === recommended && <span className="text-xs text-primary font-medium">Recomendado</span>}
                <h3 className="font-display text-lg font-bold mt-1">{PLAN_LABELS[plan]}</h3>
                <p className="font-mono text-2xl mt-2">{formatBRL(PLAN_PRICES_CENTS[plan] / 100)}<span className="text-sm text-muted-foreground">/mês</span></p>
                {plan === recommended && <p className="text-sm text-muted-foreground mt-3">{content.planJustification}</p>}
              </div>
            ))}
          </div>
        </section>

        <section id="cases" data-section>
          <h2 className="font-display text-xl font-bold mb-4">Casos de sucesso</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {(content.successCases ?? []).map((c) => (
              <div key={c.name} className="rounded-lg border border-border/60 p-4">
                <p className="font-medium">{c.name}</p>
                <p className="text-sm text-primary mt-1">{c.result}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="faq" data-section>
          <h2 className="font-display text-xl font-bold mb-4">Perguntas frequentes</h2>
          <div className="space-y-4">
            {(content.faq ?? []).map((f) => (
              <div key={f.q}>
                <p className="font-medium">{f.q}</p>
                <p className="text-sm text-muted-foreground mt-1">{f.a}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="text-center">
          <Link to="/login" className="inline-flex items-center gap-2 rounded-lg bg-primary-gradient px-6 py-3 font-semibold text-primary-foreground">
            Aceitar proposta <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
