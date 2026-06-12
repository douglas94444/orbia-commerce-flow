import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  useStartPacking,
  useConfirmPackingItem,
  useCompletePacking,
  usePackingOrderItems,
  useGeneratePackingLabel,
} from "@/modules/logistics/hooks/use-fulfillly";
import { useOfflineSync } from "@/modules/logistics/ops-pwa/use-offline-sync";
import { playOpsError, playOpsSuccess } from "@/modules/logistics/ops-pwa/use-ops-feedback";
import type { PackingSessionStart } from "@/modules/logistics/packing/packing.server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BarcodeScanner } from "@/modules/logistics/ops-pwa/barcode-scanner";
import { printLabelViaWebUsb } from "@/modules/logistics/ops-pwa/use-thermal-printer";
import { Check, CheckCircle2, Loader2, Package, Printer, Tag } from "lucide-react";
import { cn } from "@/shared/lib/utils";

export const Route = createFileRoute("/ops/packing")({
  component: OpsPackingPage,
});

function OpsPackingPage() {
  const [orderId, setOrderId] = useState("");
  const [session, setSession] = useState<PackingSessionStart | null>(null);
  const [localSessionId, setLocalSessionId] = useState("");
  const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set());
  const [sku, setSku] = useState("");
  const [qty, setQty] = useState(1);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);

  const startPacking = useStartPacking();
  const confirmItem = useConfirmPackingItem();
  const complete = useCompletePacking();
  const generateLabel = useGeneratePackingLabel();
  const [labelUrl, setLabelUrl] = useState<string | null>(null);
  const { queueAction } = useOfflineSync();
  const { data: orderItems = [], isLoading: loadingItems, refetch: refetchItems } =
    usePackingOrderItems(session ? orderId : undefined);

  const sessionId = session?.sessionId ?? localSessionId;
  const allItemsPacked = orderItems.length > 0 && orderItems.every((i) => i.packedQty >= i.qty);
  const checklistDone =
    !session?.checklist.length || session.checklist.every((_, idx) => checkedItems.has(idx));

  const pendingSkus = useMemo(
    () => orderItems.filter((i) => i.packedQty < i.qty).map((i) => i.sku),
    [orderItems],
  );

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

  const submitStartPacking = async () => {
    const offlineLocalId = crypto.randomUUID();
    if (await queueAction("start_pack", { orderId, localSessionId: offlineLocalId })) {
      setLocalSessionId(offlineLocalId);
      setSession({ sessionId: offlineLocalId, checklist: [], brandingUrl: null, insertMaterialSku: null });
      playOpsSuccess();
      toast.success("Início de packing salvo offline");
      return;
    }
    startPacking.mutate(orderId, {
      onSuccess: (result) => {
        setSession(result);
        setCheckedItems(new Set());
        playOpsSuccess();
      },
      onError: () => playOpsError(),
    });
  };

  const submitPackItem = async (scanSku?: string) => {
    const targetSku = scanSku ?? sku;
    if (!targetSku) return;
    const payload = { orderId, sku: targetSku, qty: scanSku ? 1 : qty };
    if (await queueAction("confirm_pack", payload)) {
      playOpsSuccess();
      toast.success("Salvo offline — sincroniza ao reconectar");
      setSku("");
      return;
    }
    confirmItem.mutate(payload, {
      onSuccess: () => {
        playOpsSuccess();
        setSku("");
        void refetchItems();
      },
      onError: () => playOpsError(),
    });
  };

  const handleScan = (code: string) => {
    const match = orderItems.find((i) => i.sku === code);
    if (match) {
      void submitPackItem(code);
    } else if (pendingSkus.includes(code)) {
      void submitPackItem(code);
    } else {
      playOpsError();
      toast.error("SKU não pertence a este pedido");
    }
  };

  const toggleChecklist = (idx: number) => {
    setCheckedItems((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const submitComplete = async () => {
    if (!allItemsPacked) {
      playOpsError();
      toast.error("Confirme todos os itens antes de fechar");
      return;
    }
    if (!checklistDone) {
      playOpsError();
      toast.error("Complete o checklist de embalagem");
      return;
    }
    if (await queueAction("complete_pack", { sessionId, photoUrls, orderId })) {
      playOpsSuccess();
      toast.success("Fechamento salvo offline — fotos sincronizam ao reconectar");
      setPhotoUrls([]);
      return;
    }
    complete.mutate(
      { sessionId, photoUrls },
      {
        onSuccess: () => {
          playOpsSuccess();
          setSession(null);
          setLocalSessionId("");
          setOrderId("");
          setCheckedItems(new Set());
          setPhotoUrls([]);
        },
        onError: () => playOpsError(),
      },
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-semibold">Packing</h1>
        <p className="text-sm text-muted-foreground">Checklist guiado + conferência de itens</p>
      </div>

      {!sessionId && (
        <div className="space-y-3 rounded-xl border border-border p-4">
          <Input
            placeholder="ID do pedido"
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
          />
          <Button
            className="w-full"
            variant="outline"
            onClick={() => void submitStartPacking()}
            disabled={!orderId || startPacking.isPending}
          >
            {startPacking.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Iniciar packing
          </Button>
        </div>
      )}

      {sessionId && (
        <div className="space-y-4">
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
            <p className="text-xs text-muted-foreground">
              Sessão {sessionId.slice(0, 8)} · Pedido {orderId.slice(0, 8)}
            </p>
            {session?.insertMaterialSku && (
              <p className="mt-1 text-sm">
                Material de inserção: <span className="font-mono">{session.insertMaterialSku}</span>
              </p>
            )}
            {session?.brandingUrl && (
              <img
                src={session.brandingUrl}
                alt="Branding"
                className="mt-2 max-h-16 rounded border border-border"
              />
            )}
          </div>

          {session && session.checklist.length > 0 && (
            <div className="space-y-2 rounded-xl border border-border p-4">
              <p className="text-xs font-medium uppercase text-muted-foreground">Checklist</p>
              {session.checklist.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => toggleChecklist(idx)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg border p-3 text-left text-sm transition-colors",
                    checkedItems.has(idx)
                      ? "border-success/50 bg-success/10"
                      : "border-border bg-card",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-full border",
                      checkedItems.has(idx) ? "border-success bg-success text-success-foreground" : "",
                    )}
                  >
                    {checkedItems.has(idx) ? <Check className="size-3" /> : null}
                  </span>
                  {item}
                </button>
              ))}
            </div>
          )}

          <div className="space-y-2 rounded-xl border border-border p-4">
            <p className="text-xs font-medium uppercase text-muted-foreground">Itens do pedido</p>
            {loadingItems ? (
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            ) : orderItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum item encontrado</p>
            ) : (
              orderItems.map((item) => {
                const done = item.packedQty >= item.qty;
                return (
                  <div
                    key={item.sku}
                    className={cn(
                      "flex items-center justify-between rounded-lg border p-3",
                      done ? "border-success/40 bg-success/5" : "border-border",
                    )}
                  >
                    <div>
                      <p className="font-mono font-medium">{item.sku}</p>
                      <p className="text-xs text-muted-foreground">Qtd {item.qty}</p>
                    </div>
                    <span className="font-mono text-sm">
                      {done ? (
                        <CheckCircle2 className="size-5 text-success" />
                      ) : (
                        `${item.packedQty}/${item.qty}`
                      )}
                    </span>
                  </div>
                );
              })
            )}
          </div>

          <BarcodeScanner onScan={handleScan} />

          <div className="flex gap-2">
            <Input
              placeholder="SKU manual"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              className="font-mono"
            />
            <Input
              type="number"
              placeholder="Qtd"
              value={qty}
              onChange={(e) => setQty(Number(e.target.value))}
              className="w-20 font-mono"
            />
            <Button onClick={() => void submitPackItem()} disabled={!sku || confirmItem.isPending}>
              OK
            </Button>
          </div>

          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Foto evidência</label>
            <Input type="file" accept="image/*" capture="environment" onChange={handlePhotoCapture} />
            {photoUrls.length > 0 && (
              <p className="mt-1 text-xs text-success">{photoUrls.length} foto(s) anexada(s)</p>
            )}
          </div>

          <Button
            className="w-full"
            variant="outline"
            onClick={() =>
              generateLabel.mutate(orderId, {
                onSuccess: (res) => {
                  playOpsSuccess();
                  if (res.labelUrl) {
                    setLabelUrl(res.labelUrl);
                    window.open(res.labelUrl, "_blank");
                  }
                  toast.success(`Etiqueta ${res.trackingCode}`);
                },
                onError: () => playOpsError(),
              })
            }
            disabled={generateLabel.isPending || !allItemsPacked}
          >
            <Tag className="mr-2 size-4" />
            Gerar etiqueta na estação
          </Button>

          {labelUrl && (
            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void printLabelViaWebUsb(labelUrl)}
              >
                <Printer className="mr-2 size-4" />
                Imprimir (WebUSB)
              </Button>
              <a
                href={labelUrl}
                target="_blank"
                rel="noreferrer"
                className="block text-center text-xs text-primary underline"
              >
                Reabrir etiqueta no navegador
              </a>
            </div>
          )}

          <Button
            className="w-full"
            onClick={() => void submitComplete()}
            disabled={complete.isPending || !allItemsPacked || !checklistDone}
          >
            <Package className="mr-2 size-4" />
            Fechar embalagem
          </Button>
        </div>
      )}
    </div>
  );
}
