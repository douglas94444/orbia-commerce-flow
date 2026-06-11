import { createFileRoute, Link } from "@tanstack/react-router";
import { PageIntro, Panel } from "@/components/dashboard/panel";
import {
  useGeneratePickWave,
  useGenerateWaveLabels,
  useDispatchManifest,
  useExportManifestCsv,
  usePickWaves,
} from "@/modules/logistics/hooks/use-fulfillly";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Smartphone, Copy, FileText, Download, ExternalLink } from "lucide-react";
import { toast } from "sonner";

type LabelResult = {
  orderId: string;
  trackingCode?: string;
  labelUrl?: string;
  error?: string;
};

export const Route = createFileRoute("/_dashboard/logistics/picking")({
  head: () => ({ meta: [{ title: "Picking — Fulfillly" }] }),
  component: PickingPage,
});

function PickingPage() {
  const [waveId, setWaveId] = useState("");
  const [lastWaveId, setLastWaveId] = useState<string | null>(null);
  const [labelResults, setLabelResults] = useState<LabelResult[]>([]);
  const [manifest, setManifest] = useState<{
    waveId: string;
    generatedAt: string;
    orders: Array<{
      orderId: string;
      trackingCode: string | null;
      carrier: string | null;
      labelUrl: string | null;
    }>;
  } | null>(null);

  const { data: waves } = usePickWaves();
  const generateWave = useGeneratePickWave();
  const generateLabels = useGenerateWaveLabels();
  const loadManifest = useDispatchManifest();
  const exportCsv = useExportManifestCsv();

  const selectedWave = waves?.find((w) => w.id === waveId);
  const canGenerateLabels =
    selectedWave != null &&
    selectedWave.completedTaskCount > 0 &&
    selectedWave.pendingLineCount === 0;

  const copyWaveId = (id: string) => {
    void navigator.clipboard.writeText(id);
    toast.success("ID da onda copiado");
  };

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Fulfillly"
        title="Ondas de separação"
        description="Agrupa pedidos em ondas otimizadas por rota no armazém."
      />

      <Panel
        title="Ondas ativas"
        action={
          <Link to="/ops/picking">
            <Button variant="outline" size="sm">
              <Smartphone className="mr-1 size-4" />
              App operador
            </Button>
          </Link>
        }
      >
        {(waves ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma onda registrada</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {(waves ?? []).map((w) => (
              <li
                key={w.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2"
              >
                <div>
                  <button
                    type="button"
                    className="font-mono text-xs text-primary hover:underline"
                    onClick={() => setWaveId(w.id)}
                  >
                    {w.id.slice(0, 8)}…
                  </button>
                  <p className="text-xs text-muted-foreground">
                    {new Date(w.createdAt).toLocaleString("pt-BR")} · {w.status} ·{" "}
                    {w.completedTaskCount}/{w.taskCount} pedidos · {w.pendingLineCount} linha(s)
                    pendente(s)
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => copyWaveId(w.id)}>
                  <Copy className="size-3" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Gerar onda">
        <p className="mb-4 text-sm text-muted-foreground">
          Pedidos em separação com NF autorizada entram na próxima onda, ordenados por SLA.
          Pedidos com task aberta são ignorados.
        </p>
        <Button
          onClick={() =>
            generateWave.mutate(undefined, {
              onSuccess: (res) => {
                if (res?.waveId) {
                  setLastWaveId(res.waveId);
                  setWaveId(res.waveId);
                }
              },
            })
          }
          disabled={generateWave.isPending}
        >
          {generateWave.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
          Gerar onda de picking
        </Button>
        {lastWaveId && (
          <p className="mt-3 font-mono text-sm text-primary">
            Última onda: {lastWaveId}
            <Button
              variant="link"
              size="sm"
              className="ml-2 h-auto p-0"
              onClick={() => copyWaveId(lastWaveId)}
            >
              Copiar ID
            </Button>
          </p>
        )}
      </Panel>

      <Panel title="Impressão em lote / manifesto">
        <div className="flex flex-wrap gap-2">
          <Input
            className="max-w-xs font-mono"
            placeholder="ID da onda"
            value={waveId}
            onChange={(e) => setWaveId(e.target.value)}
          />
          <Button
            variant="outline"
            disabled={!waveId || !canGenerateLabels || generateLabels.isPending}
            onClick={() =>
              generateLabels.mutate(waveId, {
                onSuccess: (results) => {
                  setLabelResults(results as LabelResult[]);
                  const ok = (results as LabelResult[]).filter((r) => r.trackingCode).length;
                  const err = (results as LabelResult[]).filter((r) => r.error).length;
                  if (!results.length) {
                    toast.info("Nenhuma task concluída nesta onda");
                  } else {
                    toast.success(`${ok} etiqueta(s) · ${err} erro(s)`);
                  }
                },
              })
            }
          >
            Gerar etiquetas da onda
          </Button>
          <Button
            variant="outline"
            disabled={!waveId || loadManifest.isPending}
            onClick={() =>
              loadManifest.mutate(waveId, {
                onSuccess: (data) => setManifest(data),
              })
            }
          >
            <FileText className="mr-1 size-4" />
            Manifesto
          </Button>
          <Button
            variant="outline"
            disabled={!waveId || exportCsv.isPending}
            onClick={() =>
              exportCsv.mutate(waveId, {
                onSuccess: ({ csv }) => {
                  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `manifesto-${waveId.slice(0, 8)}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                  toast.success("CSV exportado");
                },
              })
            }
          >
            <Download className="mr-1 size-4" />
            Exportar CSV
          </Button>
        </div>
        {selectedWave && !canGenerateLabels && (
          <p className="mt-2 text-xs text-yellow-500">
            Etiquetas disponíveis quando todos os pedidos da onda estiverem conferidos (
            {selectedWave.completedTaskCount}/{selectedWave.taskCount} concluídos,{" "}
            {selectedWave.pendingLineCount} linhas pendentes).
          </p>
        )}

        {labelResults.length > 0 && (
          <ul className="mt-4 space-y-1 text-sm">
            {labelResults.map((r) => (
              <li key={r.orderId} className="flex flex-wrap items-center gap-2 font-mono">
                <span>{r.orderId.slice(0, 8)}…</span>
                {r.trackingCode ? (
                  <>
                    <span className="text-success">{r.trackingCode}</span>
                    {r.labelUrl && (
                      <a
                        href={r.labelUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary"
                      >
                        <ExternalLink className="size-3" />
                        PDF
                      </a>
                    )}
                  </>
                ) : (
                  <span className="text-destructive">{r.error ?? "erro"}</span>
                )}
              </li>
            ))}
          </ul>
        )}

        {manifest && (
          <div className="mt-4 rounded-lg border border-border p-3 text-sm">
            <p className="text-xs text-muted-foreground">
              Manifesto {manifest.waveId.slice(0, 8)}… —{" "}
              {new Date(manifest.generatedAt).toLocaleString("pt-BR")}
            </p>
            <ul className="mt-2 space-y-1 font-mono">
              {manifest.orders.map((o) => (
                <li key={o.orderId} className="flex flex-wrap items-center gap-2">
                  <span>
                    {o.orderId.slice(0, 8)}… {o.trackingCode ?? "—"} ({o.carrier ?? "—"})
                  </span>
                  {o.labelUrl && (
                    <a
                      href={o.labelUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary"
                    >
                      etiqueta
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Panel>
    </div>
  );
}
