import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ExternalLink, Loader2, Tag, Truck } from "lucide-react";
import { PageIntro, Panel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";
import { useDispatchQueue } from "@/modules/logistics/hooks/use-fulfillly";
import { useDispatchOrder } from "@/modules/logistics/hooks/use-logistics";

export const Route = createFileRoute("/_dashboard/logistics/dispatch")({
  head: () => ({ meta: [{ title: "Expedição — Fulfillly" }] }),
  component: DispatchPage,
});

function DispatchPage() {
  const { data: queue = [], isLoading, refetch } = useDispatchQueue();
  const dispatch = useDispatchOrder();

  const handleDispatch = (orderId: string) => {
    dispatch.mutate(orderId, { onSuccess: () => void refetch() });
  };

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Fulfillly"
        title="Expedição"
        description="Fila de pedidos embalados (em_packing) com NF autorizada — gere etiquetas e imprima antes do handoff."
        action={<Truck className="size-5 text-primary" />}
      />

      <Link to="/logistics">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="mr-2 size-4" />
          Voltar à logística
        </Button>
      </Link>

      <Panel title={`Fila de expedição (${queue.length})`}>
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Carregando fila…
          </div>
        ) : queue.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum pedido pronto. Conclua o packing para liberar expedição.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-left">
                  {["Pedido", "Canal", "Peso (kg)", "Aguardando desde", ""].map((h) => (
                    <th
                      key={h}
                      className="pb-3 text-[10px] font-medium uppercase tracking-wider text-muted-foreground"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {queue.map((row) => (
                  <tr key={row.orderId} className="transition-colors hover:bg-muted/30">
                    <td className="py-3 font-mono text-xs text-foreground">{row.externalId}</td>
                    <td className="py-3 text-sm text-muted-foreground">{row.channel}</td>
                    <td className="py-3 font-mono text-sm text-foreground">
                      {row.weightKg != null ? row.weightKg.toFixed(2) : "—"}
                    </td>
                    <td className="py-3 text-sm text-muted-foreground">
                      {new Date(row.createdAt).toLocaleString("pt-BR")}
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {row.labelUrl && (
                          <a
                            href={row.labelUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            <ExternalLink className="size-3" />
                            Etiqueta
                          </a>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 gap-1 px-2 text-xs"
                          disabled={dispatch.isPending}
                          onClick={() => handleDispatch(row.orderId)}
                        >
                          {dispatch.isPending ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            <Tag className="size-3" />
                          )}
                          Gerar etiqueta
                        </Button>
                      </div>
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
