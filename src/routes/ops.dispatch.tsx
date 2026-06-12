import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  useDispatchQueue,
  useDispatchOpsOrder,
} from "@/modules/logistics/hooks/use-fulfillly";
import { playOpsError, playOpsSuccess } from "@/modules/logistics/ops-pwa/use-ops-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BarcodeScanner } from "@/modules/logistics/ops-pwa/barcode-scanner";
import { Loader2, Send, Truck } from "lucide-react";

export const Route = createFileRoute("/ops/dispatch")({
  component: OpsDispatchPage,
});

function OpsDispatchPage() {
  const { data: queue = [], isLoading, refetch } = useDispatchQueue();
  const dispatch = useDispatchOpsOrder();
  const [scanValue, setScanValue] = useState("");

  const findOrder = (code: string) =>
    queue.find(
      (row) =>
        row.orderId === code ||
        row.externalId === code ||
        row.externalId.toLowerCase() === code.toLowerCase(),
    );

  const submitDispatch = (orderId: string) => {
    dispatch.mutate(orderId, {
      onSuccess: () => {
        playOpsSuccess();
        void refetch();
      },
      onError: () => playOpsError(),
    });
  };

  const handleScan = (code: string) => {
    const match = findOrder(code);
    if (match) {
      submitDispatch(match.orderId);
    } else {
      playOpsError();
      toast.error("Pedido não está na fila de despacho");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 size-5 animate-spin" />
        Carregando fila…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-semibold">Despacho</h1>
        <p className="text-sm text-muted-foreground">
          {queue.length} pedido(s) prontos — NF autorizada e packing concluído
        </p>
      </div>

      <BarcodeScanner onScan={handleScan} />

      <div className="flex gap-2">
        <Input
          placeholder="ID ou código do pedido"
          value={scanValue}
          onChange={(e) => setScanValue(e.target.value)}
          className="font-mono"
        />
        <Button
          variant="outline"
          disabled={!scanValue || dispatch.isPending}
          onClick={() => {
            const match = findOrder(scanValue);
            if (match) submitDispatch(match.orderId);
            else {
              playOpsError();
              toast.error("Pedido não encontrado na fila");
            }
          }}
        >
          OK
        </Button>
      </div>

      {queue.length === 0 ? (
        <div className="rounded-xl border border-border py-12 text-center">
          <Truck className="mx-auto size-10 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">Fila de despacho vazia</p>
        </div>
      ) : (
        <div className="space-y-2">
          {queue.map((row) => (
            <div
              key={row.orderId}
              className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4"
            >
              <div>
                <p className="font-mono font-semibold">{row.externalId}</p>
                <p className="text-xs text-muted-foreground">
                  {row.channel}
                  {row.weightKg != null ? ` · ${row.weightKg} kg` : ""}
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => submitDispatch(row.orderId)}
                disabled={dispatch.isPending}
              >
                <Send className="mr-1 size-3" />
                Despachar
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
