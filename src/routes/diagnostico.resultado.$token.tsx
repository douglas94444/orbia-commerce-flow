import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { ArrowRight, Download, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DIAGNOSTIC_TRIPWIRE_CENTS } from "@/shared/constants/plans";
import {
  useConfirmTripwire,
  useDiagnosticResult,
  useDownloadDiagnosticPdf,
  useTripwireCheckout,
} from "@/modules/sales/hooks/use-sales";

export const Route = createFileRoute("/diagnostico/resultado/$token")({
  validateSearch: (s: Record<string, unknown>) => ({
    paid: s.paid === "1" || s.paid === 1,
  }),
  head: () => ({ meta: [{ title: "Seu Diagnóstico — Orbia" }] }),
  component: DiagnosticoResultadoPage,
});

function ScoreRing({ score }: { score: number }) {
  const color = score >= 80 ? "text-green-400" : score >= 50 ? "text-amber-400" : "text-red-400";
  return (
    <div className={cn("font-mono text-6xl font-bold", color)}>{score}</div>
  );
}

function DiagnosticoResultadoPage() {
  const { token } = Route.useParams();
  const { paid } = Route.useSearch();
  const { data, isLoading, refetch } = useDiagnosticResult(token);
  const tripwire = useTripwireCheckout();
  const confirmPaid = useConfirmTripwire();
  const downloadPdf = useDownloadDiagnosticPdf();

  useEffect(() => {
    if (paid) confirmPaid.mutate(token, { onSuccess: () => refetch() });
  }, [paid, token]);

  if (isLoading || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const gaps = (data.gaps as Array<{ title: string; description: string; severity: string; solution: string }>) ?? [];
  const dimensions = (data.dimensions as Array<{ label: string; score: number; impact: string }>) ?? [];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4">
        <Link to="/" className="font-bold">Orbia</Link>
      </header>

      <div className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-sm text-primary font-medium">Diagnóstico para {data.companyName}</p>
        <h1 className="font-display text-3xl font-bold mt-2">Score de saúde da operação</h1>

        <div className="mt-8 flex items-center gap-8">
          <ScoreRing score={data.overallScore} />
          <div>
            <p className="text-muted-foreground text-sm">de 100 pontos</p>
            <p className="mt-2 text-lg">
              Potencial de crescimento: <span className="font-mono text-primary">+{data.potentialGrowthPct}%</span> em 90 dias
            </p>
          </div>
        </div>

        <p className="mt-6 text-muted-foreground leading-relaxed">{data.narrative}</p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {dimensions.map((d) => (
            <div key={d.label} className="rounded-xl border border-border/60 bg-card/50 p-4">
              <div className="flex justify-between items-center">
                <span className="font-medium text-sm">{d.label}</span>
                <span className="font-mono">{d.score}/100</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">{d.impact}</p>
            </div>
          ))}
        </div>

        {gaps.length > 0 && (
          <div className="mt-8">
            <h2 className="font-display text-xl font-bold mb-4">Lacunas críticas</h2>
            <div className="space-y-3">
              {gaps.map((g) => (
                <div key={g.title} className={cn("rounded-lg border p-4", g.severity === "critical" ? "border-red-400/30 bg-red-400/5" : "border-amber-400/30 bg-amber-400/5")}>
                  <p className="font-medium">{g.title}</p>
                  <p className="text-sm text-muted-foreground mt-1">{g.description}</p>
                  <p className="text-sm text-primary mt-2">→ {g.solution}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8 flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => downloadPdf.mutate(token)} disabled={downloadPdf.isPending}>
            <Download className="h-4 w-4 mr-2" /> Baixar PDF
          </Button>
        </div>

        {!data.isPaid ? (
          <div className="mt-10 rounded-xl border border-primary/30 bg-primary/5 p-6">
            <div className="flex items-center gap-2 text-primary">
              <Sparkles className="h-5 w-5" />
              <h3 className="font-display text-lg font-bold">Diagnóstico completo Meta Ads</h3>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Relatório detalhado com análise de campanhas, pixel, públicos e retargeting — por apenas R$ {(DIAGNOSTIC_TRIPWIRE_CENTS / 100).toFixed(2)}.
            </p>
            <Button
              className="mt-4 gap-2"
              onClick={async () => {
                const res = await tripwire.mutateAsync({ token, email: data.email ?? "" });
                if (!res.alreadyPaid && res.initPoint) window.location.href = res.initPoint;
              }}
              disabled={tripwire.isPending}
            >
              Desbloquear relatório completo <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        ) : data.metaDiagnostic && (
          <div className="mt-10 rounded-xl border border-border p-6">
            <h3 className="font-display text-lg font-bold">Meta Ads — {data.metaDiagnostic.overallScore}/100</h3>
            <p className="text-sm text-muted-foreground mt-2">{data.metaDiagnostic.narrative}</p>
            <div className="mt-4 space-y-2">
              {(data.metaDiagnostic.dimensions as Array<{ label: string; score: number; finding: string }>).map((d) => (
                <div key={d.label} className="text-sm flex justify-between">
                  <span>{d.label}</span>
                  <span className="font-mono">{d.score}/100</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-10 text-center">
          <Link to="/login" className="inline-flex items-center gap-2 text-primary font-medium hover:underline">
            Falar com especialista Orbia <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
