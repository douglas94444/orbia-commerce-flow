import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  useConfirmPickLine,
  useMarkPickLineNotFound,
  useOpsTasks,
} from "@/modules/logistics/hooks/use-fulfillly";
import { useOfflineSync } from "@/modules/logistics/ops-pwa/use-offline-sync";
import { playOpsError, playOpsSuccess } from "@/modules/logistics/ops-pwa/use-ops-feedback";
import {
  getSlaBucket,
  SLA_BUCKET_CLASS,
  SLA_BUCKET_LABEL,
} from "@/modules/logistics/ops-pwa/sla-bucket";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BarcodeScanner } from "@/modules/logistics/ops-pwa/barcode-scanner";
import { AlertTriangle, CheckCircle2, Clock, Loader2, MapPin, Navigation } from "lucide-react";
import { cn } from "@/shared/lib/utils";

type PickLine = {
  lineId: string;
  taskId: string;
  sku: string;
  qtyRequired: number;
  orderExternalId: string;
  locationLabel: string | null;
  slaDeadlineAt: string | null;
};

type PickOrderProgress = {
  taskId: string;
  orderExternalId: string;
  pickedCount: number;
  totalCount: number;
  slaDeadlineAt: string | null;
};

export const Route = createFileRoute("/ops/picking")({
  validateSearch: (search: Record<string, unknown>) => ({
    lineId: typeof search.lineId === "string" ? search.lineId : undefined,
  }),
  component: OpsPickingPage,
});

function OpsPickingPage() {
  const { lineId: searchLineId } = Route.useSearch();
  const { data, isLoading, refetch } = useOpsTasks();
  const pickLines = (data?.pickLines ?? []) as PickLine[];
  const orderProgress = (data?.pickOrderProgress ?? []) as PickOrderProgress[];
  const [activeLineId, setActiveLineId] = useState<string | undefined>(searchLineId);
  const [guidedMode, setGuidedMode] = useState(true);
  const [manualBarcode, setManualBarcode] = useState("");
  const confirm = useConfirmPickLine();
  const notFound = useMarkPickLineNotFound();
  const { queueAction } = useOfflineSync();

  const nextLine = pickLines[0];
  const visibleLines = guidedMode ? (nextLine ? [nextLine] : []) : pickLines;

  useEffect(() => {
    if (searchLineId) setActiveLineId(searchLineId);
    else if (!activeLineId && nextLine) setActiveLineId(nextLine.lineId);
  }, [searchLineId, nextLine, activeLineId]);

  const activeLine =
    pickLines.find((l) => l.lineId === activeLineId) ?? nextLine ?? undefined;

  const submitPick = async (lineId: string, code: string) => {
    if (await queueAction("confirm_pick", { taskLineId: lineId, barcode: code })) {
      playOpsSuccess();
      toast.success("Salvo offline — sincroniza ao reconectar");
      setManualBarcode("");
      await refetch();
      return;
    }
    confirm.mutate(
      { taskLineId: lineId, barcode: code },
      {
        onSuccess: (res) => {
          if (!res.ok) {
            playOpsError();
            return;
          }
          playOpsSuccess();
          setManualBarcode("");
          void refetch();
        },
        onError: () => playOpsError(),
      },
    );
  };

  const handleScan = (code: string) => {
    const match =
      pickLines.find((l) => l.lineId === activeLineId) ??
      pickLines.find((l) => l.sku === code);
    if (match) {
      setActiveLineId(match.lineId);
      void submitPick(match.lineId, code);
    } else if (activeLineId) {
      void submitPick(activeLineId, code);
    } else {
      playOpsError();
      toast.error("Selecione uma linha ou escaneie um SKU da fila");
    }
  };

  const handleNotFound = async (lineId: string) => {
    if (await queueAction("mark_pick_not_found", { taskLineId: lineId })) {
      playOpsSuccess();
      toast.success("Salvo offline — sincroniza ao reconectar");
      await refetch();
      return;
    }
    notFound.mutate(lineId, {
      onSuccess: (res) => {
        if (!res.ok) {
          playOpsError();
          return;
        }
        playOpsSuccess();
        void refetch();
      },
      onError: () => playOpsError(),
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 size-5 animate-spin" />
        Carregando fila…
      </div>
    );
  }

  if (!pickLines.length) {
    return (
      <div className="space-y-4 py-8 text-center">
        <CheckCircle2 className="mx-auto size-10 text-success" />
        <p className="font-display text-lg font-semibold">Fila vazia</p>
        <p className="text-sm text-muted-foreground">
          Nenhum item pendente de picking. Gere uma onda no dashboard.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="font-display text-xl font-semibold">Picking</h1>
          <p className="text-sm text-muted-foreground">
            {pickLines.length} linha(s) pendente(s)
            {guidedMode && nextLine ? " — modo rota guiada (SLA)" : ""}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setGuidedMode((v) => !v)}
        >
          <Navigation className="mr-1 size-3" />
          {guidedMode ? "Ver todos" : "Rota guiada"}
        </Button>
      </div>

      {orderProgress.length > 0 && (
        <div className="space-y-1 rounded-xl border border-border p-3">
          <p className="text-xs uppercase text-muted-foreground">Progresso por pedido</p>
          {orderProgress.map((o) => {
            const bucket = getSlaBucket(o.slaDeadlineAt);
            return (
              <div key={o.taskId} className="flex items-center justify-between text-sm">
                <span className="font-mono">{o.orderExternalId}</span>
                <div className="flex items-center gap-2">
                  {o.slaDeadlineAt && (
                    <span className={cn("text-[10px] font-medium", SLA_BUCKET_CLASS[bucket])}>
                      {SLA_BUCKET_LABEL[bucket]}
                    </span>
                  )}
                  <span className="font-mono text-primary">
                    {o.pickedCount}/{o.totalCount}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <BarcodeScanner onScan={handleScan} />

      <div className="flex gap-2">
        <Input
          placeholder="Digitar barcode manualmente"
          value={manualBarcode}
          onChange={(e) => setManualBarcode(e.target.value)}
          className="font-mono"
        />
        <Button
          variant="outline"
          disabled={!manualBarcode || !activeLine}
          onClick={() => activeLine && void submitPick(activeLine.lineId, manualBarcode)}
        >
          OK
        </Button>
      </div>

      <div className="space-y-2">
        {visibleLines.map((line) => {
          const bucket = getSlaBucket(line.slaDeadlineAt);
          return (
            <button
              key={line.lineId}
              type="button"
              onClick={() => setActiveLineId(line.lineId)}
              className={cn(
                "w-full rounded-xl border p-4 text-left transition-colors",
                activeLineId === line.lineId
                  ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                  : "border-border bg-card",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-mono text-lg font-semibold">{line.sku}</p>
                {line.slaDeadlineAt && (
                  <span
                    className={cn(
                      "flex shrink-0 items-center gap-1 text-[10px] font-medium",
                      SLA_BUCKET_CLASS[bucket],
                    )}
                  >
                    <Clock className="size-3" />
                    {SLA_BUCKET_LABEL[bucket]}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {line.orderExternalId} · qtd {line.qtyRequired}
              </p>
              {line.locationLabel && (
                <p className="mt-2 flex items-center gap-1 rounded-lg bg-primary/15 px-2 py-1 text-sm font-medium text-primary">
                  <MapPin className="size-4" />
                  {line.locationLabel}
                </p>
              )}
            </button>
          );
        })}
      </div>

      {activeLine && (
        <div className="space-y-2 rounded-xl border border-primary/30 bg-primary/5 p-4">
          <p className="text-xs text-muted-foreground">Ação na linha ativa</p>
          <Button
            className="w-full"
            onClick={() => void submitPick(activeLine.lineId, activeLine.sku)}
            disabled={confirm.isPending}
          >
            <CheckCircle2 className="mr-2 size-4" />
            Confirmar sem scanner
          </Button>
          <Button
            className="w-full"
            variant="outline"
            onClick={() => void handleNotFound(activeLine.lineId)}
            disabled={notFound.isPending}
          >
            <AlertTriangle className="mr-2 size-4" />
            Item não encontrado
          </Button>
        </div>
      )}
    </div>
  );
}
