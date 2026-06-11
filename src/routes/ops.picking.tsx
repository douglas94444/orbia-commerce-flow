import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useConfirmPickLine, useOpsTasks } from "@/modules/logistics/hooks/use-fulfillly";
import { useOfflineSync } from "@/modules/logistics/ops-pwa/use-offline-sync";
import { Button } from "@/components/ui/button";
import { BarcodeScanner } from "@/modules/logistics/ops-pwa/barcode-scanner";
import { CheckCircle2, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

type PickLine = {
  lineId: string;
  sku: string;
  qtyRequired: number;
  orderExternalId: string;
  locationLabel: string | null;
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
  const { data, refetch } = useOpsTasks();
  const pickLines = (data?.pickLines ?? []) as PickLine[];
  const [activeLineId, setActiveLineId] = useState<string | undefined>(searchLineId);
  const confirm = useConfirmPickLine();
  const { queueAction } = useOfflineSync();

  useEffect(() => {
    if (searchLineId) setActiveLineId(searchLineId);
    else if (!activeLineId && pickLines.length) setActiveLineId(pickLines[0].lineId);
  }, [searchLineId, pickLines, activeLineId]);

  const activeLine = pickLines.find((l) => l.lineId === activeLineId);

  const submitPick = async (lineId: string, code: string) => {
    if (await queueAction("confirm_pick", { taskLineId: lineId, barcode: code })) {
      toast.success("Salvo offline — sincroniza ao reconectar");
      await refetch();
      return;
    }
    confirm.mutate(
      { taskLineId: lineId, barcode: code },
      {
        onSuccess: (res) => {
          if (res?.ok) {
            toast.success("Item confirmado!");
            void refetch();
            const idx = pickLines.findIndex((l) => l.lineId === lineId);
            if (idx >= 0 && pickLines[idx + 1]) setActiveLineId(pickLines[idx + 1].lineId);
          }
        },
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
      toast.error("Selecione uma linha ou escaneie um SKU da fila");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-semibold">Picking</h1>
        <p className="text-sm text-muted-foreground">
          {pickLines.length} linha(s) pendente(s) — escaneie para confirmar
        </p>
      </div>

      <BarcodeScanner onScan={handleScan} />

      <div className="max-h-64 space-y-2 overflow-y-auto">
        {pickLines.map((line) => (
          <button
            key={line.lineId}
            type="button"
            onClick={() => setActiveLineId(line.lineId)}
            className={cn(
              "w-full rounded-xl border p-3 text-left text-sm transition-colors",
              activeLineId === line.lineId
                ? "border-primary bg-primary/10"
                : "border-border bg-card",
            )}
          >
            <p className="font-mono font-medium">{line.sku}</p>
            <p className="text-xs text-muted-foreground">
              {line.orderExternalId} · qtd {line.qtyRequired}
            </p>
            {line.locationLabel && (
              <p className="mt-1 flex items-center gap-1 text-xs text-primary">
                <MapPin className="size-3" />
                {line.locationLabel}
              </p>
            )}
          </button>
        ))}
      </div>

      {activeLine && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
          <p className="text-xs text-muted-foreground">Linha ativa</p>
          <p className="font-mono text-lg font-semibold">{activeLine.sku}</p>
          <Button
            className="mt-3 w-full"
            onClick={() => void submitPick(activeLine.lineId, activeLine.sku)}
            disabled={confirm.isPending}
          >
            <CheckCircle2 className="mr-2 size-4" />
            Confirmar sem scanner
          </Button>
        </div>
      )}
    </div>
  );
}
