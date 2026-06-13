import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageIntro, Panel } from "@/components/dashboard/panel";
import { KpiCard } from "@/components/dashboard/kpi-card";
import {
  useReturns,
  useApproveReturn,
  useRejectReturn,
  useMarkReturnReceived,
  useInspectReturn,
  useUploadReturnInspectionPhoto,
  useReturnReasonsReport,
  useReturnRateKpi,
} from "@/modules/logistics/hooks/use-fulfillly";
import { useReturnFiscalStatus } from "@/modules/fiscal/hooks/use-fiscal";
import { buildTrackingUrl } from "@/modules/logistics/shipping/tracking-link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusPill } from "@/components/dashboard/status-pill";

export const Route = createFileRoute("/_dashboard/logistics/returns")({
  head: () => ({ meta: [{ title: "Devoluções — Fulfillly" }] }),
  component: ReturnsPage,
});

const STATUS_TONE: Record<string, "warning" | "primary" | "success" | "danger" | "accent"> = {
  pending: "warning",
  approved: "primary",
  in_transit: "accent",
  received: "primary",
  completed: "success",
  rejected: "danger",
  cancelled: "danger",
};

type ReturnRow = {
  id: string;
  order_id?: string;
  reason: string;
  status: string;
  tracking_code: string | null;
  return_label_url: string | null;
  request_type: string;
  exchange_sku: string | null;
  resolution: string | null;
  exchange_order_id: string | null;
  metadata: Record<string, unknown> | null;
};

function ReturnsPage() {
  const { data: returns = [], isLoading } = useReturns();
  const { data: reasonReport = [] } = useReturnReasonsReport();
  const { data: rateKpi } = useReturnRateKpi();
  const approve = useApproveReturn();
  const reject = useRejectReturn();
  const scheduleReceiving = useMarkReturnReceived();
  const inspect = useInspectReturn();
  const uploadPhoto = useUploadReturnInspectionPhoto();

  const [inspectId, setInspectId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [refundReais, setRefundReais] = useState("");

  const handlePhoto = async (returnRequestId: string, file: File) => {
    const reader = new FileReader();
    reader.onload = async () => {
      if (typeof reader.result !== "string") return;
      const { url } = await uploadPhoto.mutateAsync({ returnRequestId, dataUrl: reader.result });
      setPhotoUrls((prev) => [...prev, url]);
    };
    reader.readAsDataURL(file);
  };

  const submitInspect = (destination: "reintegrate" | "quarantine" | "discard") => {
    if (!inspectId) return;
    inspect.mutate(
      { returnRequestId: inspectId, destination, notes: notes || undefined, photoUrls },
      {
        onSuccess: () => {
          setInspectId(null);
          setNotes("");
          setPhotoUrls([]);
        },
      },
    );
  };

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Fulfillly"
        title="Logística reversa"
        description="Aprovação, etiqueta, conferência, inspeção, NF-e e resolução (reembolso, troca ou crédito)."
      />

      <Panel title="Fluxo unificado devolução → recebimento">
        <p className="mb-3 text-sm text-muted-foreground">
          Ao aprovar uma devolução, um agendamento de recebimento é criado automaticamente no PWA ops.
          O operador confere os itens em{" "}
          <Link to="/ops/receiving" className="text-primary underline">
            /ops/receiving
          </Link>{" "}
          com badge &quot;Devolução&quot;.
        </p>
        <Link to="/ops/receiving">
          <Button size="sm" variant="outline">
            Abrir recebimento ops
          </Button>
        </Link>
      </Panel>

      {rateKpi && (
        <div className="grid gap-4 sm:grid-cols-3">
          <KpiCard label="Devoluções" value={String(rateKpi.totalReturns)} />
          <KpiCard label="Pedidos entregues" value={String(rateKpi.totalDeliveredOrders)} />
          <KpiCard label="Taxa de devolução" value={`${rateKpi.returnRatePercent}%`} />
        </div>
      )}

      <Panel title="Solicitações">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : returns.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma devolução</p>
        ) : (
          <div className="space-y-3">
            {(returns as ReturnRow[]).map((r) => {
              const meta = (r.metadata ?? {}) as Record<string, unknown>;
              const carrier = String(meta.carrier_provider_id ?? "");
              return (
                <div key={r.id} className="rounded-xl border border-border p-4">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-xs">{r.id.slice(0, 8)}</span>
                    <div className="flex gap-2">
                      {r.request_type === "exchange" && (
                        <StatusPill label="Troca" tone="accent" />
                      )}
                      <StatusPill label={r.status} tone={STATUS_TONE[r.status] ?? "primary"} />
                    </div>
                  </div>
                  <p className="text-sm">{r.reason}</p>
                  {r.resolution && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Resolução: {r.resolution}
                      {r.exchange_sku ? ` → ${r.exchange_sku}` : ""}
                    </p>
                  )}
                  {r.tracking_code && (
                    <p className="mt-1 font-mono text-xs text-muted-foreground">
                      Rastreio:{" "}
                      <a
                        href={buildTrackingUrl(r.tracking_code, carrier || undefined)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        {r.tracking_code}
                      </a>
                    </p>
                  )}
                  {r.exchange_order_id && (
                    <p className="mt-1 text-xs">
                      Pedido de troca:{" "}
                      <Link
                        to="/logistics/orders"
                        className="font-mono text-primary hover:underline"
                      >
                        {r.exchange_order_id.slice(0, 8)}
                      </Link>
                    </p>
                  )}
                  <ReturnFiscalPanel returnRequestId={r.id} />
                  <div className="mt-3 flex flex-wrap gap-2">
                    {r.status === "pending" && (
                      <>
                        <Input
                          className="h-8 w-28 text-xs"
                          placeholder="R$ reembolso"
                          value={refundReais}
                          onChange={(e) => setRefundReais(e.target.value)}
                        />
                        <Button
                          size="sm"
                          onClick={() =>
                            approve.mutate({
                              returnRequestId: r.id,
                              refundCents: refundReais
                                ? Math.round(parseFloat(refundReais.replace(",", ".")) * 100)
                                : undefined,
                            })
                          }
                          disabled={approve.isPending}
                        >
                          Aprovar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => reject.mutate({ returnRequestId: r.id })}
                          disabled={reject.isPending}
                        >
                          Rejeitar
                        </Button>
                      </>
                    )}
                    {r.status === "approved" && (
                      <Link to="/ops/receiving">
                        <Button size="sm" variant="outline">
                          Receber no galpão
                        </Button>
                      </Link>
                    )}
                    {r.status === "in_transit" && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => scheduleReceiving.mutate(r.id)}
                        >
                          Agendar conferência
                        </Button>
                        <Link to="/ops/receiving">
                          <Button size="sm">Conferir no PWA</Button>
                        </Link>
                      </>
                    )}
                    {r.status === "received" && (
                      <Button size="sm" onClick={() => setInspectId(r.id)}>
                        Inspecionar
                      </Button>
                    )}
                  </div>
                  {inspectId === r.id && (
                    <div className="mt-4 rounded-lg border border-border bg-muted/20 p-3">
                      <Input
                        className="mb-2"
                        placeholder="Notas da inspeção"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                      />
                      <input
                        type="file"
                        accept="image/*"
                        className="mb-2 block text-xs"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) void handlePhoto(r.id, f);
                        }}
                      />
                      {photoUrls.length > 0 && (
                        <p className="mb-2 text-xs text-muted-foreground">
                          {photoUrls.length} foto(s) anexada(s)
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" onClick={() => submitInspect("reintegrate")}>
                          Reintegrar
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => submitInspect("quarantine")}>
                          Quarentena
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => submitInspect("discard")}>
                          Descartar
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setInspectId(null)}>
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      <Panel title="Relatório — motivos por SKU, canal e transportadora">
        {reasonReport.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem dados</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[10px] uppercase text-muted-foreground">
                  {["Motivo", "Canal", "SKU", "Transportadora", "Ocorr.", "Qtd"].map((h) => (
                    <th key={h} className="pb-2 pr-4">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {reasonReport.map((row) => (
                  <tr key={`${row.reason}-${row.channel}-${row.sku}-${row.carrier}`}>
                    <td className="py-2 pr-4">{row.reason}</td>
                    <td className="py-2 pr-4 text-muted-foreground">{row.channel}</td>
                    <td className="py-2 pr-4 font-mono text-xs">{row.sku}</td>
                    <td className="py-2 pr-4 text-muted-foreground">{row.carrier}</td>
                    <td className="py-2 pr-4 font-mono">{row.count}</td>
                    <td className="py-2 font-mono">{row.totalQty}</td>
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

function ReturnFiscalPanel({ returnRequestId }: { returnRequestId: string }) {
  const { data, isLoading } = useReturnFiscalStatus(returnRequestId);

  if (isLoading) {
    return <p className="mt-2 text-xs text-muted-foreground">Carregando status fiscal…</p>;
  }
  if (!data?.saleNfe && !data?.returnNfe) {
    return (
      <p className="mt-2 text-xs text-muted-foreground">
        NF-e de venda ainda não autorizada para este pedido.
      </p>
    );
  }

  return (
    <div className="mt-3 rounded-lg border border-border/60 bg-muted/10 p-3 text-xs">
      <p className="mb-2 font-medium text-foreground">Documentos fiscais</p>
      {data.saleNfe && (
        <div className="mb-2">
          <span className="text-muted-foreground">NF venda: </span>
          <StatusPill label={data.saleNfe.status} tone="success" />
          {data.saleNfe.accessKey && (
            <p className="mt-1 font-mono text-[10px] text-muted-foreground break-all">
              Chave: {data.saleNfe.accessKey}
            </p>
          )}
          <Link
            to="/fiscal/$id"
            params={{ id: data.saleNfe.id }}
            className="mt-1 inline-block text-primary hover:underline"
          >
            Ver NF venda
          </Link>
        </div>
      )}
      {data.returnNfe ? (
        <div>
          <span className="text-muted-foreground">NF devolução (entrada): </span>
          <StatusPill
            label={data.returnNfe.status}
            tone={data.returnNfe.status === "autorizada" ? "success" : "warning"}
          />
          {data.returnNfe.accessKey && (
            <p className="mt-1 font-mono text-[10px] text-muted-foreground break-all">
              Chave referenciada: {data.returnNfe.accessKey}
            </p>
          )}
          <Link
            to="/fiscal/$id"
            params={{ id: data.returnNfe.id }}
            className="mt-1 inline-block text-primary hover:underline"
          >
            Ver NF devolução
          </Link>
        </div>
      ) : (
        <p className="text-muted-foreground">NF de devolução ainda não emitida.</p>
      )}
    </div>
  );
}
