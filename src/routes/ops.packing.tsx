import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  useStartPacking,
  useConfirmPackingItem,
  useCompletePacking,
} from "@/modules/logistics/hooks/use-fulfillly";
import { useOfflineSync } from "@/modules/logistics/ops-pwa/use-offline-sync";
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
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);

  const startPacking = useStartPacking();
  const confirmItem = useConfirmPackingItem();
  const complete = useCompletePacking();
  const { queueAction } = useOfflineSync();

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setPhotoUrls((prev) => [...prev, reader.result as string]);
      }
    };
    reader.readAsDataURL(file);
  };

  const submitPackItem = async () => {
    const payload = { orderId, sku, qty };
    if (await queueAction("confirm_pack", payload)) {
      toast.success("Salvo offline — sincroniza ao reconectar");
      setSku("");
      return;
    }
    confirmItem.mutate(payload);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-semibold">Packing</h1>
        <p className="text-sm text-muted-foreground">Checklist + foto de evidência</p>
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
          <Button className="w-full" onClick={() => void submitPackItem()} disabled={!sku}>
            Confirmar item
          </Button>

          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Foto evidência</label>
            <Input type="file" accept="image/*" capture="environment" onChange={handlePhotoCapture} />
            {photoUrls.length > 0 && (
              <p className="mt-1 text-xs text-success">{photoUrls.length} foto(s) anexada(s)</p>
            )}
          </div>

          <Button
            className="w-full"
            variant="default"
            onClick={() => complete.mutate({ sessionId, photoUrls })}
            disabled={complete.isPending}
          >
            Fechar embalagem
          </Button>
        </div>
      )}
    </div>
  );
}
