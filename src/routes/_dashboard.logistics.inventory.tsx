import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageIntro, Panel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useInventoryCounts,
  useInventoryCountLines,
  useStartInventoryCount,
  useRecordInventoryCountLine,
  useCompleteInventoryCount,
} from "@/modules/logistics/hooks/use-fulfillly";
import { exportInventoryCountFn } from "@/modules/logistics/fulfillly.actions.functions";
import { ArrowLeft, ClipboardList } from "lucide-react";

export const Route = createFileRoute("/_dashboard/logistics/inventory")({
  head: () => ({ meta: [{ title: "Inventário — Fulfillly" }] }),
  component: InventoryCountPage,
});

function InventoryCountPage() {
  const { data: counts = [], isLoading } = useInventoryCounts();
  const startCount = useStartInventoryCount();
  const recordLine = useRecordInventoryCountLine();
  const completeCount = useCompleteInventoryCount();
  const [activeCountId, setActiveCountId] = useState<string | null>(null);
  const [sku, setSku] = useState("");
  const [countedQty, setCountedQty] = useState(0);
  const [rotativoSkus, setRotativoSkus] = useState("");
  const [aisle, setAisle] = useState("");
  const { data: lines = [] } = useInventoryCountLines(activeCountId);

  const openCount = counts.find((c) => c.status === "open");

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Fulfillly WMS"
        title="Inventário"
        description="Inventário rotativo ou geral com relatório de divergências e ajuste automático."
        action={<ClipboardList className="size-5 text-primary" />}
      />

      <Link to="/logistics/warehouse">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="mr-2 size-4" />
          Voltar ao armazém
        </Button>
      </Link>

      <Panel title="Iniciar contagem">
        <div className="mb-3 grid gap-2 sm:grid-cols-2">
          <Input
            placeholder="SKUs rotativo (vírgula)"
            value={rotativoSkus}
            onChange={(e) => setRotativoSkus(e.target.value)}
          />
          <Input placeholder="Corredor (opcional)" value={aisle} onChange={(e) => setAisle(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={!!openCount || startCount.isPending}
            onClick={() =>
              startCount.mutate({
                countType: "rotativo",
                skus: rotativoSkus ? rotativoSkus.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
                aisle: aisle || undefined,
              })
            }
          >
            Inventário rotativo
          </Button>
          <Button
            variant="outline"
            disabled={!!openCount || startCount.isPending}
            onClick={() => startCount.mutate({ countType: "geral" })}
          >
            Inventário geral
          </Button>
        </div>
        {openCount && (
          <p className="mt-2 text-sm text-muted-foreground">
            Contagem aberta: {openCount.id.slice(0, 8)} ({openCount.countType})
          </p>
        )}
      </Panel>

      {(activeCountId || openCount) && (
        <Panel title="Registrar contagem">
          <div className="mb-4 flex gap-2">
            <select
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
              value={activeCountId ?? openCount?.id ?? ""}
              onChange={(e) => setActiveCountId(e.target.value)}
            >
              {(openCount ? [openCount] : counts.filter((c) => c.status === "open")).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.countType} — {c.id.slice(0, 8)}
                </option>
              ))}
            </select>
            <Button
              variant="outline"
              onClick={() =>
                completeCount.mutate(activeCountId ?? openCount!.id)
              }
              disabled={completeCount.isPending}
            >
              Finalizar e ajustar divergências
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                const id = activeCountId ?? openCount!.id;
                const { csv } = await exportInventoryCountFn({ data: { countId: id } });
                const blob = new Blob([csv], { type: "text/csv" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `inventario-${id.slice(0, 8)}.csv`;
                a.click();
              }}
            >
              Exportar CSV
            </Button>
          </div>
          <div className="mb-4 grid gap-2 sm:grid-cols-3">
            <Input placeholder="SKU" value={sku} onChange={(e) => setSku(e.target.value)} />
            <Input
              type="number"
              placeholder="Qtd contada"
              value={countedQty}
              onChange={(e) => setCountedQty(Number(e.target.value))}
            />
            <Button
              onClick={() =>
                recordLine.mutate({
                  countId: activeCountId ?? openCount!.id,
                  sku,
                  countedQty,
                })
              }
              disabled={!sku}
            >
              Registrar SKU
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                  <th className="pb-2 pr-4">SKU</th>
                  <th className="pb-2 pr-4">Sistema</th>
                  <th className="pb-2 pr-4">Contado</th>
                  <th className="pb-2">Divergência</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l: { id: string; sku: string; system_qty: number; counted_qty: number | null; divergence: number | null }) => (
                  <tr key={l.id} className="border-b border-border/50">
                    <td className="py-2 pr-4 font-mono text-xs">{l.sku}</td>
                    <td className="py-2 pr-4 font-mono">{l.system_qty}</td>
                    <td className="py-2 pr-4 font-mono">{l.counted_qty ?? "—"}</td>
                    <td
                      className={`py-2 font-mono ${l.divergence && l.divergence !== 0 ? "text-warning" : ""}`}
                    >
                      {l.counted_qty != null ? l.divergence : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      <Panel title="Histórico de inventários">
        {isLoading ? (
          <div className="h-24 animate-pulse rounded-xl bg-muted/40" />
        ) : counts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum inventário realizado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                  <th className="pb-2 pr-4">Tipo</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2 pr-4">SKUs</th>
                  <th className="pb-2">Divergências</th>
                </tr>
              </thead>
              <tbody>
                {counts.map((c) => (
                  <tr
                    key={c.id}
                    className="cursor-pointer border-b border-border/50 hover:bg-muted/30"
                    onClick={() => setActiveCountId(c.id)}
                  >
                    <td className="py-2 pr-4 capitalize">{c.countType}</td>
                    <td className="py-2 pr-4">{c.status}</td>
                    <td className="py-2 pr-4 font-mono">{c.lineCount}</td>
                    <td className="py-2 font-mono text-warning">{c.divergenceCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
