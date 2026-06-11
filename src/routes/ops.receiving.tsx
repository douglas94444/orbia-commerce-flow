import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  useConfirmReceivingLine,
  useCompleteReceivingSession,
  useOpsReceivingAppointments,
  useReceivingSessionContext,
  useStartReceivingSession,
  useWarehouseLocations,
} from "@/modules/logistics/hooks/use-fulfillly";
import { useOfflineSync } from "@/modules/logistics/ops-pwa/use-offline-sync";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BarcodeScanner } from "@/modules/logistics/ops-pwa/barcode-scanner";
import { cn } from "@/shared/lib/utils";

export const Route = createFileRoute("/ops/receiving")({
  component: OpsReceivingPage,
});

function OpsReceivingPage() {
  const [sessionId, setSessionId] = useState("");
  const [selectedSku, setSelectedSku] = useState("");
  const [barcodeScanned, setBarcodeScanned] = useState("");
  const [receivedQty, setReceivedQty] = useState(1);
  const [locationId, setLocationId] = useState("");
  const [lotCode, setLotCode] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  const { data: appointments } = useOpsReceivingAppointments();
  const { data: sessionCtx, refetch: refetchSession } = useReceivingSessionContext(
    sessionId || null,
  );
  const { data: locations } = useWarehouseLocations();
  const startSession = useStartReceivingSession();
  const confirm = useConfirmReceivingLine();
  const complete = useCompleteReceivingSession();
  const { queueAction } = useOfflineSync();

  const pendingItems = useMemo(() => {
    if (!sessionCtx) return [];
    const confirmed = new Set(sessionCtx.confirmedLines.map((l) => l.sku));
    return sessionCtx.expectedItems.filter((i) => !confirmed.has(i.sku));
  }, [sessionCtx]);

  const activeItem = sessionCtx?.expectedItems.find((i) => i.sku === selectedSku);
  const expectedQty = activeItem?.qty ?? 1;
  const hasDivergence = receivedQty !== expectedQty;

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setPhotoDataUrl(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const startFromAppointment = (appointmentId: string) => {
    startSession.mutate(appointmentId, {
      onSuccess: (id) => {
        setSessionId(id as string);
        setSelectedSku("");
        toast.success("Sessão iniciada");
      },
    });
  };

  const selectSku = (sku: string, qty: number) => {
    setSelectedSku(sku);
    setReceivedQty(qty);
    setBarcodeScanned("");
    setPhotoDataUrl(null);
    setLastError(null);
  };

  const submitLine = async () => {
    if (!sessionId || !selectedSku) return;
    setLastError(null);

    if (hasDivergence && !photoDataUrl) {
      setLastError("Foto obrigatória em caso de divergência ou avaria");
      return;
    }

    const payload = {
      sessionId,
      sku: selectedSku,
      expectedQty,
      receivedQty,
      barcodeScanned: barcodeScanned || undefined,
      locationId: locationId || undefined,
      photoDataUrl: photoDataUrl ?? undefined,
      lotCode: lotCode || undefined,
      expiresAt: expiresAt || undefined,
    };

    if (await queueAction("confirm_receive", payload)) {
      toast.success("Salvo offline — sincroniza ao reconectar");
      setSelectedSku("");
      return;
    }

    confirm.mutate(payload, {
      onError: (e) => setLastError(e.message),
      onSuccess: () => {
        setBarcodeScanned("");
        setPhotoDataUrl(null);
        setSelectedSku("");
        void refetchSession();
      },
    });
  };

  const submitComplete = () => {
    if (!sessionId) return;
    if (pendingItems.length > 0) {
      toast.error(`Faltam ${pendingItems.length} SKU(s) para conferir`);
      return;
    }
    complete.mutate(sessionId, {
      onSuccess: () => {
        setSessionId("");
        setSelectedSku("");
      },
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-semibold">Recebimento</h1>
        <p className="text-sm text-muted-foreground">
          Escolha o agendamento, confira itens com barcode e conclua a sessão
        </p>
      </div>

      {!sessionId && (
        <div className="space-y-2">
          <p className="text-xs uppercase text-muted-foreground">Agendamentos</p>
          {(appointments ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum agendamento pendente</p>
          ) : (
            <ul className="space-y-2">
              {(appointments ?? []).map((a) => (
                <li
                  key={a.id}
                  className="rounded-xl border border-border p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">
                        {new Date(a.scheduledAt).toLocaleString("pt-BR")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {a.appointmentType === "return" ? "Devolução" : "Entrada"} ·{" "}
                        {a.expectedItems.length} SKU(s) · {a.status}
                      </p>
                      <ul className="mt-1 font-mono text-xs text-muted-foreground">
                        {a.expectedItems.slice(0, 3).map((i) => (
                          <li key={i.sku}>
                            {i.sku} × {i.qty}
                          </li>
                        ))}
                        {a.expectedItems.length > 3 && (
                          <li>+{a.expectedItems.length - 3} itens</li>
                        )}
                      </ul>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => startFromAppointment(a.id)}
                      disabled={startSession.isPending}
                    >
                      Iniciar
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {sessionId && sessionCtx && (
        <>
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
            <p className="text-xs text-muted-foreground">
              Sessão {sessionId.slice(0, 8)} ·{" "}
              {sessionCtx.appointmentType === "return" ? "Devolução" : "Entrada"}
            </p>
            <p className="mt-1 text-sm">
              {sessionCtx.confirmedLines.length}/{sessionCtx.expectedItems.length} itens conferidos
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-xs uppercase text-muted-foreground">Itens do agendamento</p>
            <ul className="space-y-1">
              {sessionCtx.expectedItems.map((item) => {
                const done = sessionCtx.confirmedLines.find((l) => l.sku === item.sku);
                return (
                  <li key={item.sku}>
                    <button
                      type="button"
                      onClick={() => !done && selectSku(item.sku, item.qty)}
                      disabled={!!done}
                      className={cn(
                        "w-full rounded-lg border px-3 py-2 text-left text-sm",
                        done
                          ? "border-success/30 bg-success/10 opacity-70"
                          : selectedSku === item.sku
                            ? "border-primary bg-primary/10"
                            : "border-border",
                      )}
                    >
                      <span className="font-mono">{item.sku}</span> × {item.qty}
                      {done && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          ✓ recebido {done.receivedQty}
                          {done.hasDivergence ? " (divergência)" : ""}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {selectedSku && (
            <div className="space-y-3 rounded-xl border border-border p-4">
              <p className="font-mono text-sm">
                Conferindo: {selectedSku} (esperado {expectedQty})
              </p>

              <div className="space-y-2">
                <p className="text-xs uppercase text-muted-foreground">Scanner barcode</p>
                <BarcodeScanner onScan={(code) => setBarcodeScanned(code)} />
                {barcodeScanned && (
                  <p className="rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm font-mono">
                    Lido: {barcodeScanned}
                  </p>
                )}
              </div>

              <Input
                type="number"
                placeholder="Qtd recebida"
                value={receivedQty}
                onChange={(e) => setReceivedQty(Number(e.target.value))}
              />

              <select
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
              >
                <option value="">Posição (opcional)</option>
                {(locations ?? []).map((loc: { id: string; binCode: string }) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.binCode}
                  </option>
                ))}
              </select>

              <Input
                placeholder="Lote (opcional)"
                value={lotCode}
                onChange={(e) => setLotCode(e.target.value)}
              />
              <Input
                type="date"
                placeholder="Validade"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />

              {hasDivergence && (
                <div>
                  <label className="mb-1 block text-xs text-yellow-500">
                    Foto da avaria / divergência (obrigatória)
                  </label>
                  <Input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handlePhotoCapture}
                  />
                  {photoDataUrl && (
                    <p className="mt-1 text-xs text-success">Foto anexada</p>
                  )}
                </div>
              )}

              <Button
                className="w-full"
                onClick={() => void submitLine()}
                disabled={confirm.isPending}
              >
                Confirmar linha
              </Button>

              {lastError && (
                <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-center text-sm text-destructive">
                  {lastError}
                </p>
              )}
            </div>
          )}

          <Button
            className="w-full"
            variant="default"
            onClick={submitComplete}
            disabled={complete.isPending || pendingItems.length > 0}
          >
            Concluir recebimento
          </Button>
        </>
      )}
    </div>
  );
}
