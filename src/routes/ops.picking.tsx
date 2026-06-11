import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useConfirmPickLine } from "@/modules/logistics/hooks/use-fulfillly";
import { useOfflineSync } from "@/modules/logistics/ops-pwa/use-offline-sync";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BarcodeScanner } from "@/modules/logistics/ops-pwa/barcode-scanner";
import { CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/ops/picking")({
  component: OpsPickingPage,
});

function OpsPickingPage() {
  const [taskLineId, setTaskLineId] = useState("");
  const [barcode, setBarcode] = useState("");
  const confirm = useConfirmPickLine();
  const { queueAction } = useOfflineSync();

  const submitPick = async (lineId: string, code: string) => {
    if (await queueAction("confirm_pick", { taskLineId: lineId, barcode: code })) {
      toast.success("Salvo offline — sincroniza ao reconectar");
      setBarcode("");
      return;
    }
    confirm.mutate({ taskLineId: lineId, barcode: code });
  };

  const handleScan = (code: string) => {
    setBarcode(code);
    if (taskLineId) void submitPick(taskLineId, code);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-semibold">Picking</h1>
        <p className="text-sm text-muted-foreground">Escaneie cada item para confirmar</p>
      </div>

      <BarcodeScanner onScan={handleScan} />

      <div className="space-y-3">
        <Input
          placeholder="ID da linha de pick"
          value={taskLineId}
          onChange={(e) => setTaskLineId(e.target.value)}
        />
        <Input
          placeholder="Código de barras"
          value={barcode}
          onChange={(e) => setBarcode(e.target.value)}
        />
        <Button
          className="w-full"
          onClick={() => void submitPick(taskLineId, barcode)}
          disabled={!taskLineId || !barcode || confirm.isPending}
        >
          <CheckCircle2 className="mr-2 size-4" />
          Confirmar item
        </Button>
      </div>

      {confirm.isSuccess && confirm.data?.ok && (
        <p className="text-center text-sm font-medium text-green-500">Item confirmado!</p>
      )}
    </div>
  );
}
