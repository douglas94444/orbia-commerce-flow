import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useConfirmReceivingLine } from "@/modules/logistics/hooks/use-fulfillly";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BarcodeScanner } from "@/modules/logistics/ops-pwa/barcode-scanner";

export const Route = createFileRoute("/ops/receiving")({
  component: OpsReceivingPage,
});

function OpsReceivingPage() {
  const [sessionId, setSessionId] = useState("");
  const [sku, setSku] = useState("");
  const [expectedQty, setExpectedQty] = useState(1);
  const [receivedQty, setReceivedQty] = useState(1);
  const confirm = useConfirmReceivingLine();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-semibold">Recebimento</h1>
        <p className="text-sm text-muted-foreground">Conferência por código de barras</p>
      </div>

      <BarcodeScanner onScan={(code) => setSku(code)} />

      <div className="space-y-3">
        <Input
          placeholder="ID da sessão"
          value={sessionId}
          onChange={(e) => setSessionId(e.target.value)}
        />
        <Input placeholder="SKU" value={sku} onChange={(e) => setSku(e.target.value)} />
        <div className="grid grid-cols-2 gap-2">
          <Input
            type="number"
            placeholder="Esperado"
            value={expectedQty}
            onChange={(e) => setExpectedQty(Number(e.target.value))}
          />
          <Input
            type="number"
            placeholder="Recebido"
            value={receivedQty}
            onChange={(e) => setReceivedQty(Number(e.target.value))}
          />
        </div>
        <Button
          className="w-full"
          onClick={() =>
            confirm.mutate({
              sessionId,
              sku,
              expectedQty,
              receivedQty,
              barcodeScanned: sku,
            })
          }
          disabled={!sessionId || !sku}
        >
          Confirmar linha
        </Button>
        {receivedQty !== expectedQty && (
          <p className="text-center text-sm text-yellow-500">Divergência detectada</p>
        )}
      </div>
    </div>
  );
}
