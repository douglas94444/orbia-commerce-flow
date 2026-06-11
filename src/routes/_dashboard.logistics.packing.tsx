import { createFileRoute, Link } from "@tanstack/react-router";
import { PageIntro, Panel } from "@/components/dashboard/panel";
import { useOrders } from "@/modules/logistics/hooks/use-logistics";
import { Button } from "@/components/ui/button";
import { Smartphone } from "lucide-react";
import { StatusPill } from "@/components/dashboard/status-pill";

export const Route = createFileRoute("/_dashboard/logistics/packing")({
  head: () => ({ meta: [{ title: "Packing — Fulfillly" }] }),
  component: PackingPage,
});

function PackingPage() {
  const { data: orders = [], isLoading } = useOrders();
  const packingOrders = orders.filter(
    (o) => o.status === "em_packing" || o.status === "em_picking",
  );

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Fulfillly"
        title="Packing"
        description="Pedidos prontos para embalagem com checklist e evidência fotográfica."
      />
      <Panel
        title="Fila de packing"
        action={
          <Link to="/ops/packing">
            <Button variant="outline" size="sm">
              <Smartphone className="mr-1 size-4" />
              App operador
            </Button>
          </Link>
        }
      >
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : packingOrders.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum pedido em packing. Conclua o picking primeiro.
          </p>
        ) : (
          <div className="space-y-2">
            {packingOrders.map((o) => (
              <div
                key={o.id}
                className="flex items-center justify-between rounded-xl border border-border px-4 py-3"
              >
                <div>
                  <p className="font-mono text-sm">{o.id}</p>
                  <p className="text-xs text-muted-foreground">{o.client}</p>
                </div>
                <StatusPill
                  label={o.status === "em_packing" ? "Packing" : "Picking"}
                  tone="primary"
                />
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
