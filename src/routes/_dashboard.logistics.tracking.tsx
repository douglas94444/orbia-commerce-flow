import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, ExternalLink, MapPin, Truck } from "lucide-react";
import { PageIntro, Panel } from "@/components/dashboard/panel";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { StatusPill, type Tone } from "@/components/dashboard/status-pill";
import { Button } from "@/components/ui/button";
import {
  useTrackingQueue,
  useOrderTrackingTimeline,
} from "@/modules/logistics/hooks/use-fulfillly";

export const Route = createFileRoute("/_dashboard/logistics/tracking")({
  head: () => ({ meta: [{ title: "Rastreamento — Fulfillly" }] }),
  component: TrackingPage,
});

const STATUS_LABEL: Record<string, { label: string; tone: Tone }> = {
  despachado: { label: "Despachado", tone: "accent" },
  em_transito: { label: "Em trânsito", tone: "primary" },
  entregue: { label: "Entregue", tone: "success" },
};

function TrackingPage() {
  const [statusFilter, setStatusFilter] = useState<string | "all">("all");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const { data, isLoading } = useTrackingQueue();
  const { data: timeline } = useOrderTrackingTimeline(selectedOrderId);

  const queue = data?.queue ?? [];
  const stats = data?.stats ?? { despachado: 0, emTransito: 0, entregue: 0, comProblema: 0 };
  const filtered =
    statusFilter === "all" ? queue : queue.filter((r) => r.status === statusFilter);

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Fulfillly"
        title="Rastreamento"
        description="Timeline unificada de todos os canais — status da transportadora, eventos e links de rastreio."
        action={<Truck className="size-5 text-primary" />}
      />

      <Link to="/logistics">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="mr-2 size-4" />
          Voltar à logística
        </Button>
      </Link>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Despachados" value={String(stats.despachado)} accent="accent" icon={Truck} />
        <KpiCard label="Em trânsito" value={String(stats.emTransito)} accent="primary" icon={Truck} />
        <KpiCard label="Entregues" value={String(stats.entregue)} accent="success" icon={Truck} />
        <KpiCard label="Com problema" value={String(stats.comProblema)} accent="warning" icon={MapPin} />
      </div>

      <Panel title="Fila de rastreamento">
        <div className="mb-4 flex flex-wrap gap-2">
          {(["all", "despachado", "em_transito", "entregue"] as const).map((s) => (
            <Button
              key={s}
              size="sm"
              variant={statusFilter === s ? "default" : "outline"}
              onClick={() => setStatusFilter(s)}
            >
              {s === "all" ? "Todos" : (STATUS_LABEL[s]?.label ?? s)}
            </Button>
          ))}
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum pedido com rastreio neste filtro.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[10px] uppercase text-muted-foreground">
                  {["Pedido", "Canal", "Status", "Transportadora", "Rastreio", ""].map((h) => (
                    <th key={h} className="pb-2 pr-4">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((row) => (
                  <tr
                    key={row.orderId}
                    className={`cursor-pointer transition-colors hover:bg-muted/30${selectedOrderId === row.orderId ? " bg-muted/40" : ""}`}
                    onClick={() => setSelectedOrderId(row.orderId)}
                  >
                    <td className="py-2 pr-4 font-mono text-xs">{row.externalId}</td>
                    <td className="py-2 pr-4 text-muted-foreground">{row.channel}</td>
                    <td className="py-2 pr-4">
                      <StatusPill
                        label={STATUS_LABEL[row.status]?.label ?? row.status}
                        tone={STATUS_LABEL[row.status]?.tone ?? "primary"}
                      />
                    </td>
                    <td className="py-2 pr-4">{row.carrier ?? "—"}</td>
                    <td className="py-2 pr-4 font-mono text-xs">{row.trackingCode ?? "—"}</td>
                    <td className="py-2">
                      {row.trackingUrl && (
                        <a
                          href={row.trackingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="size-3" />
                          Rastrear
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {selectedOrderId && timeline?.order && (
        <Panel title={`Timeline — ${timeline.order.externalId}`}>
          <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
            <StatusPill
              label={STATUS_LABEL[timeline.order.status]?.label ?? timeline.order.status}
              tone={STATUS_LABEL[timeline.order.status]?.tone ?? "primary"}
            />
            {timeline.order.carrierStatus && (
              <span className="font-mono text-xs text-muted-foreground">
                Carrier: {timeline.order.carrierStatus}
              </span>
            )}
            {timeline.order.trackingUrl && (
              <a
                href={timeline.order.trackingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline"
              >
                Abrir rastreio externo
              </a>
            )}
          </div>
          <ul className="space-y-2 border-l-2 border-primary/30 pl-4">
            {(timeline.events ?? []).map((ev) => (
              <li key={ev.id} className="relative text-sm">
                <span className="absolute -left-[1.35rem] top-1.5 size-2 rounded-full bg-primary" />
                <p className="font-medium">{STATUS_LABEL[ev.status]?.label ?? ev.status}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(ev.occurredAt).toLocaleString("pt-BR")} · {ev.source}
                </p>
              </li>
            ))}
            {(timeline.events ?? []).length === 0 && (
              <li className="text-sm text-muted-foreground">Sem eventos registrados</li>
            )}
          </ul>
        </Panel>
      )}
    </div>
  );
}
