import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Loader2, Trophy } from "lucide-react";
import { PageIntro, Panel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/format";
import { useActivatePartner, usePartnerRanking, usePartners } from "@/modules/sales/hooks/use-sales";

export const Route = createFileRoute("/_dashboard/sales/partners")({
  head: () => ({ meta: [{ title: "Parceiros — Orbia Vendas" }] }),
  component: PartnersPage,
});

function PartnersPage() {
  const { data: partners = [], isLoading } = usePartners();
  const { data: ranking = [] } = usePartnerRanking();
  const activate = useActivatePartner();

  return (
    <div className="space-y-6">
      <Link to="/sales" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Pipeline
      </Link>

      <PageIntro
        eyebrow="Programa de parceiros"
        title="Gestores & indicadores"
        description="Links de indicação, comissões recorrentes e ranking."
      />

      <Panel>
        <h3 className="font-display flex items-center gap-2 mb-4">
          <Trophy className="h-5 w-5 text-amber-400" /> Ranking
        </h3>
        <div className="space-y-2">
          {ranking.map((p, i) => (
            <div key={p.id} className="flex items-center gap-3 text-sm">
              <span className="font-mono w-6 text-muted-foreground">#{i + 1}</span>
              <span className="flex-1 font-medium">{p.name}</span>
              <span className="text-xs uppercase text-primary">{p.tier}</span>
              <span className="font-mono">{p.converted} convertidos</span>
            </div>
          ))}
        </div>
      </Panel>

      {isLoading ? (
        <Loader2 className="h-8 w-8 animate-spin mx-auto" />
      ) : (
        <Panel>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-3">Parceiro</th>
                <th className="pb-3">Código</th>
                <th className="pb-3">Tier</th>
                <th className="pb-3">Status</th>
                <th className="pb-3"></th>
              </tr>
            </thead>
            <tbody>
              {partners.map((p) => (
                <tr key={p.id} className="border-b border-border/50">
                  <td className="py-3">{p.name}<br /><span className="text-xs text-muted-foreground">{p.email}</span></td>
                  <td className="py-3 font-mono">{p.referral_code}</td>
                  <td className="py-3 capitalize">{p.tier}</td>
                  <td className="py-3">{p.status}</td>
                  <td className="py-3">
                    {p.status === "pending" && (
                      <Button size="sm" variant="outline" onClick={() => activate.mutate(p.id)}>
                        Ativar
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}
    </div>
  );
}
