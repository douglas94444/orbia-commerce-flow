import { createFileRoute, Link } from "@tanstack/react-router";
import { PageIntro, Panel } from "@/components/dashboard/panel";
import { useGeneratePickWave } from "@/modules/logistics/hooks/use-fulfillly";
import { Button } from "@/components/ui/button";
import { Loader2, Smartphone } from "lucide-react";

export const Route = createFileRoute("/_dashboard/logistics/picking")({
  head: () => ({ meta: [{ title: "Picking — Fulfillly" }] }),
  component: PickingPage,
});

function PickingPage() {
  const generateWave = useGeneratePickWave();

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Fulfillly"
        title="Ondas de separação"
        description="Agrupa pedidos em ondas otimizadas por rota no armazém."
      />
      <Panel
        title="Gerar onda"
        action={
          <Link to="/ops">
            <Button variant="outline" size="sm">
              <Smartphone className="mr-1 size-4" />
              App operador
            </Button>
          </Link>
        }
      >
        <p className="mb-4 text-sm text-muted-foreground">
          Pedidos em separação com NF autorizada entram na próxima onda, ordenados por SLA.
        </p>
        <Button onClick={() => generateWave.mutate()} disabled={generateWave.isPending}>
          {generateWave.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
          Gerar onda de picking
        </Button>
      </Panel>
    </div>
  );
}
