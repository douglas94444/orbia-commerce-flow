import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useConfirmReceivingLine } from "@/modules/logistics/hooks/use-fulfillly";
import { useOfflineSync } from "@/modules/logistics/ops-pwa/use-offline-sync";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BarcodeScanner } from "@/modules/logistics/ops-pwa/barcode-scanner";

export const Route = createFileRoute("/ops/receiving")({
  component: OpsReceivingPage,
});

function OpsReceivingPage() {
  const [sessionId, setSessionId] = useState("");
  const [sku, setSku] = useState("");
  const [barcodeScanned, setBarcodeScanned] = useState("");
  const [expectedQty, setExpectedQty] = useState(1);
  const [receivedQty, setReceivedQty] = useState(1);
  const [lotCode, setLotCode] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [lastError, setLastError] = useState<string | null>(null);
  const confirm = useConfirmReceivingLine();
  const { queueAction } = useOfflineSync();

  const submitLine = async () => {
    setLastError(null);
    const payload = {
      sessionId,
      sku,
      expectedQty,
      receivedQty,
      barcodeScanned: barcodeScanned || undefined,
      lotCode: lotCode || undefined,
      expiresAt: expiresAt || undefined,
    };
    if (await queueAction("confirm_receive", payload)) {
      toast.success("Salvo offline — sincroniza ao reconectar");
      return;
    }
    confirm.mutate(payload, {
      onError: (e) => setLastError(e.message),
      onSuccess: () => {
        setBarcodeScanned("");
        toast.success("Linha confirmada");
      },
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-semibold">Recebimento</h1>
        <p className="text-sm text-muted-foreground">SKU manual + leitura de barcode separados</p>
      </div>

      <div className="space-y-2">
        <p className="text-xs uppercase text-muted-foreground">Scanner barcode</p>
        <BarcodeScanner onScan={(code) => setBarcodeScanned(code)} />
        {barcodeScanned && (
          <p className="rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm font-mono">
            Lido: {barcodeScanned}
          </p>
        )}
      </div>

      <div className="space-y-3">
        <Input placeholder="ID da sessão" value={sessionId} onChange={(e) => setSessionId(e.target.value)} />
        <Input placeholder="SKU (do agendamento)" value={sku} onChange={(e) => setSku(e.target.value)} />
        <div className="grid grid-cols-2 gap-2">
          <Input type="number" placeholder="Esperado" value={expectedQty} onChange={(e) => setExpectedQty(Number(e.target.value))} />
          <Input type="number" placeholder="Recebido" value={receivedQty} onChange={(e) => setReceivedQty(Number(e.target.value))} />
        </div>
        <Input placeholder="Lote (opcional)" value={lotCode} onChange={(e) => setLotCode(e.target.value)} />
        <Input type="date" placeholder="Validade" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
        <Button className="w-full" onClick={() => void submitLine()} disabled={!sessionId || !sku || confirm.isPending}>
          Confirmar linha
        </Button>
        {receivedQty !== expectedQty && (
          <p className="text-center text-sm text-yellow-500">Divergência detectada</p>
        )}
        {lastError && (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-center text-sm text-destructive">
            {lastError}
          </p>
        )}
      </div>
    </div>
  );
}
