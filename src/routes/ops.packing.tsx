import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  useStartPacking,
  useConfirmPackingItem,
  useCompletePacking,
} from "@/modules/logistics/hooks/use-fulfillly";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/ops/packing")({
  component: OpsPackingPage,
});

function OpsPackingPage() {
  const [orderId, setOrderId] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [sku, setSku] = useState("");
  const [qty, setQty] = useState(1);

  const startPacking = useStartPacking();
  const confirmItem = useConfirmPackingItem();
  const complete = useCompletePacking();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-semibold">Packing</h1>
        <p className="text-sm text-muted-foreground">Checklist de itens por pedido</p>
      </div>

      <div className="space-y-3 rounded-xl border border-border p-4">
        <Input
          placeholder="ID do pedido"
          value={orderId}
          onChange={(e) => setOrderId(e.target.value)}
        />
        <Button
          className="w-full"
          variant="outline"
          onClick={() =>
            startPacking.mutate(orderId, {
              onSuccess: (id) => setSessionId(id as string),
            })
          }
          disabled={!orderId || startPacking.isPending}
        >
          Iniciar packing
        </Button>
      </div>

      {sessionId && (
        <div className="space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
          <p className="text-xs text-muted-foreground">Sessão: {sessionId.slice(0, 8)}</p>
          <Input placeholder="SKU" value={sku} onChange={(e) => setSku(e.target.value)} />
          <Input
            type="number"
            placeholder="Qtd"
            value={qty}
            onChange={(e) => setQty(Number(e.target.value))}
          />
          <Button
            className="w-full"
            onClick={() => confirmItem.mutate({ orderId, sku, qty })}
            disabled={!sku}
          >
            Confirmar item
          </Button>
          <Button
            className="w-full"
            variant="default"
            onClick={() => complete.mutate(sessionId)}
          >
            Fechar embalagem
          </Button>
        </div>
      )}
    </div>
  );
}
