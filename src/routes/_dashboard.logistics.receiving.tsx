import { createFileRoute, Link } from "@tanstack/react-router";
import { PageIntro, Panel } from "@/components/dashboard/panel";
import {
  useCreateReceivingAppointment,
  useReceivingAppointments,
  useReceivingReports,
  useExportReceivingReport,
} from "@/modules/logistics/hooks/use-fulfillly";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Smartphone, Download } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_dashboard/logistics/receiving")({
  head: () => ({ meta: [{ title: "Recebimento — Fulfillly" }] }),
  component: ReceivingPage,
});

function ReceivingPage() {
  const { data: appointments } = useReceivingAppointments();
  const createAppt = useCreateReceivingAppointment();
  const exportReport = useExportReceivingReport();
  const [sku, setSku] = useState("");
  const [qty, setQty] = useState(1);
  const [items, setItems] = useState<Array<{ sku: string; qty: number }>>([]);
  const [scheduledAt, setScheduledAt] = useState("");
  const [reportFrom, setReportFrom] = useState("");
  const [reportTo, setReportTo] = useState("");
  const { data: reports } = useReceivingReports(
    reportFrom || undefined,
    reportTo || undefined,
  );

  const divergenceCount = (reports ?? []).filter((r) => r.hasDivergence).length;

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Fulfillly WMS"
        title="Recebimento de mercadoria"
        description="Agende conferências e execute no app operador com scanner de código de barras."
      />
      <Panel
        title="Agendamentos"
        action={
          <Link to="/ops/receiving">
            <Button variant="outline" size="sm">
              <Smartphone className="mr-1 size-4" />
              Conferir no app
            </Button>
          </Link>
        }
      >
        {(appointments ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum recebimento agendado</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {(appointments ?? []).map((a) => (
              <li key={a.id} className="rounded-lg border border-border px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>{new Date(a.scheduledAt).toLocaleString("pt-BR")}</span>
                  <span className="text-xs text-muted-foreground">
                    {a.appointmentType === "return" ? "Devolução" : "Entrada"} · {a.status}
                  </span>
                </div>
                <ul className="mt-2 space-y-0.5 font-mono text-xs text-muted-foreground">
                  {a.expectedItems.map((i) => (
                    <li key={i.sku}>
                      {i.sku} × {i.qty}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Novo agendamento">
        <div className="grid gap-3 sm:grid-cols-3">
          <Input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
          />
          <Input placeholder="SKU" value={sku} onChange={(e) => setSku(e.target.value)} />
          <Input
            type="number"
            placeholder="Qtd"
            value={qty}
            onChange={(e) => setQty(Number(e.target.value))}
          />
          <Button
            variant="outline"
            onClick={() => {
              if (!sku) return;
              setItems((prev) => [...prev, { sku, qty }]);
              setSku("");
            }}
          >
            Adicionar item
          </Button>
        </div>
        {items.length > 0 && (
          <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
            {items.map((i, idx) => (
              <li key={idx} className="font-mono">
                {i.sku} × {i.qty}
              </li>
            ))}
          </ul>
        )}
        <Button
          className="mt-4"
          disabled={!scheduledAt || items.length === 0 || createAppt.isPending}
          onClick={() =>
            createAppt.mutate({
              scheduledAt: new Date(scheduledAt).toISOString(),
              expectedItems: items,
            })
          }
        >
          Agendar recebimento
        </Button>
      </Panel>

      <Panel
        title="Relatório de recebimentos"
        action={
          <Button
            variant="outline"
            size="sm"
            disabled={exportReport.isPending}
            onClick={() =>
              exportReport.mutate({
                from: reportFrom || undefined,
                to: reportTo || undefined,
              })
            }
          >
            <Download className="mr-1 size-4" />
            Exportar CSV
          </Button>
        }
      >
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <Input
            type="date"
            value={reportFrom}
            onChange={(e) => setReportFrom(e.target.value)}
            placeholder="De"
          />
          <Input
            type="date"
            value={reportTo}
            onChange={(e) => setReportTo(e.target.value)}
            placeholder="Até"
          />
        </div>
        <p className="mb-3 text-sm text-muted-foreground">
          {(reports ?? []).length} linha(s) ·{" "}
          <span className="font-mono text-yellow-500">{divergenceCount}</span> divergência(s)
        </p>
        {(reports ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum recebimento no período</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-3">Data</th>
                  <th className="py-2 pr-3">SKU</th>
                  <th className="py-2 pr-3">Esperado</th>
                  <th className="py-2 pr-3">Recebido</th>
                  <th className="py-2">Divergência</th>
                </tr>
              </thead>
              <tbody>
                {(reports ?? [])
                  .filter((r) => r.sku)
                  .slice(0, 50)
                  .map((r, idx) => (
                    <tr key={idx} className="border-b border-border/50">
                      <td className="py-2 pr-3 text-xs">
                        {new Date(r.scheduledAt).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="py-2 pr-3 font-mono">{r.sku}</td>
                      <td className="py-2 pr-3 font-mono">{r.expectedQty}</td>
                      <td className="py-2 pr-3 font-mono">{r.receivedQty}</td>
                      <td className="py-2">
                        {r.hasDivergence ? (
                          <span className="text-yellow-500">Sim</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
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
