import { createFileRoute } from "@tanstack/react-router";
import { PageIntro, Panel } from "@/components/dashboard/panel";
import {
  useWarehouseLocations,
  useStockMovements,
  useAdjustStock,
} from "@/modules/logistics/hooks/use-fulfillly";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";

export const Route = createFileRoute("/_dashboard/logistics/warehouse")({
  head: () => ({ meta: [{ title: "Armazém — Fulfillly" }] }),
  component: WarehousePage,
});

function WarehousePage() {
  const { data: locations = [], isLoading } = useWarehouseLocations();
  const { data: movements = [] } = useStockMovements();
  const adjust = useAdjustStock();
  const [sku, setSku] = useState("");
  const [delta, setDelta] = useState(0);
  const [reason, setReason] = useState("");

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Fulfillly WMS"
        title="Armazém e movimentações"
        description="Endereçamento digital, ajustes com justificativa e histórico de movimentações."
      />

      <Panel title="Posições do galpão">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : locations.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma posição cadastrada</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="pb-2">Bin</th>
                  <th className="pb-2">Corredor</th>
                  <th className="pb-2">Prateleira</th>
                  <th className="pb-2">Nível</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {locations.map((l) => (
                  <tr key={l.id}>
                    <td className="py-2 font-mono">{l.binCode}</td>
                    <td className="py-2">{l.aisle}</td>
                    <td className="py-2">{l.shelf}</td>
                    <td className="py-2">{l.level}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Ajuste manual de estoque">
        <div className="grid gap-3 sm:grid-cols-2">
          <Input placeholder="SKU" value={sku} onChange={(e) => setSku(e.target.value)} />
          <Input
            type="number"
            placeholder="Delta (+/-)"
            value={delta}
            onChange={(e) => setDelta(Number(e.target.value))}
          />
          <Input
            className="sm:col-span-2"
            placeholder="Justificativa (obrigatória)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <Button
            onClick={() => adjust.mutate({ sku, delta, reason })}
            disabled={!sku || !reason || adjust.isPending}
          >
            Aplicar ajuste
          </Button>
        </div>
      </Panel>

      <Panel title="Histórico de movimentações">
        <div className="max-h-64 overflow-y-auto space-y-1 text-sm">
          {movements.slice(0, 20).map((m) => (
            <div key={m.id} className="flex justify-between border-b border-border/50 py-1">
              <span className="font-mono">{m.sku}</span>
              <span className="text-muted-foreground">{m.movement_type}</span>
              <span className="font-mono">{m.qty}</span>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
