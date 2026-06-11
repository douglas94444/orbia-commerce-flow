import { createFileRoute, Link } from "@tanstack/react-router";
import { PageIntro, Panel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";
import {
  useQuarantineItems,
  useReleaseQuarantine,
  useDiscardQuarantine,
} from "@/modules/logistics/hooks/use-fulfillly";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_dashboard/logistics/quarantine")({
  head: () => ({ meta: [{ title: "Quarentena — Fulfillly" }] }),
  component: QuarantinePage,
});

function QuarantinePage() {
  const { data: items = [], isLoading } = useQuarantineItems();
  const release = useReleaseQuarantine();
  const discard = useDiscardQuarantine();

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Fulfillly WMS"
        title="Quarentena"
        description="Itens inspecionados aguardando liberação ou descarte."
      />
      <Link to="/logistics/warehouse">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="mr-2 size-4" />
          Voltar ao armazém
        </Button>
      </Link>

      <Panel title="Itens em quarentena">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum item em quarentena</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                  <th className="pb-2">SKU</th>
                  <th className="pb-2">Qtd</th>
                  <th className="pb-2">Motivo</th>
                  <th className="pb-2">Desde</th>
                  <th className="pb-2">Ações</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-border/50">
                    <td className="py-2 font-mono">{item.sku}</td>
                    <td className="py-2 font-mono">{item.qty}</td>
                    <td className="py-2 text-muted-foreground">{item.reason ?? "—"}</td>
                    <td className="py-2">{new Date(item.createdAt).toLocaleDateString()}</td>
                    <td className="py-2 flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => release.mutate(item.id)}>
                        Liberar
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => discard.mutate(item.id)}>
                        Descartar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
