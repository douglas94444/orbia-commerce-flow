import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageIntro, Panel } from "@/components/dashboard/panel";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { StatusPill, type Tone } from "@/components/dashboard/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useSlaDashboard,
  useSlaOrders,
  useExportSlaReportCsv,
  useSlaMonthlyReport,
  useUpsertChannelSlaRule,
} from "@/modules/logistics/hooks/use-fulfillly";
import { Clock, AlertTriangle, CheckCircle, Download, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_dashboard/logistics/sla")({
  head: () => ({ meta: [{ title: "SLA — Fulfillly" }] }),
  component: SlaPage,
});

const BUCKET_LABEL: Record<string, { label: string; tone: Tone }> = {
  on_time: { label: "No prazo", tone: "success" },
  at_risk: { label: "Em risco", tone: "warning" },
  breached: { label: "Estourado", tone: "danger" },
};

function SlaPage() {
  const [bucket, setBucket] = useState<"on_time" | "at_risk" | "breached" | undefined>(
    undefined,
  );
  const [editChannel, setEditChannel] = useState("");
  const [dispatchHours, setDispatchHours] = useState(48);
  const [alertHours, setAlertHours] = useState(6);
  const [reportMonth, setReportMonth] = useState(new Date().toISOString().slice(0, 7));

  const { data, isLoading } = useSlaDashboard();
  const { data: monthlyReport, isLoading: loadingReport } = useSlaMonthlyReport(reportMonth);
  const { data: orders = [], isLoading: loadingOrders } = useSlaOrders(bucket);
  const exportReport = useExportSlaReportCsv();
  const upsertRule = useUpsertChannelSlaRule();

  const rules = data?.rules ?? [];

  const handleExport = () => {
    exportReport.mutate(undefined, {
      onSuccess: ({ csv }) => {
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `sla-report-${new Date().toISOString().slice(0, 7)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Relatório exportado");
      },
    });
  };

  const handleSaveRule = () => {
    if (!editChannel) {
      toast.error("Selecione um canal");
      return;
    }
    upsertRule.mutate(
      { channel: editChannel, dispatchHours, alertHoursBefore: alertHours },
      {
        onSuccess: () => toast.success("Regra salva"),
      },
    );
  };

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Fulfillly"
        title="SLA por canal"
        description="Alertas preventivos, pedidos em risco e compliance de despacho."
      />

      <Link to="/logistics">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="mr-2 size-4" />
          Voltar à logística
        </Button>
      </Link>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label="No prazo"
          value={isLoading ? "—" : String(data?.onTime ?? 0)}
          icon={CheckCircle}
          accent="success"
        />
        <KpiCard
          label="Em risco"
          value={isLoading ? "—" : String(data?.atRisk ?? 0)}
          icon={Clock}
          accent="warning"
        />
        <KpiCard
          label="Estourados"
          value={isLoading ? "—" : String(data?.breached ?? 0)}
          icon={AlertTriangle}
          accent="warning"
        />
        <KpiCard
          label="Compliance"
          value={isLoading ? "—" : `${data?.compliancePercent ?? 0}%`}
          icon={CheckCircle}
          accent="primary"
        />
      </div>

      <Panel
        title="Pedidos monitorados"
        action={
          <Button variant="outline" size="sm" onClick={handleExport} disabled={exportReport.isPending}>
            <Download className="mr-1 size-4" />
            Relatório mensal CSV
          </Button>
        }
      >
        <div className="mb-4 flex flex-wrap gap-2">
          {(
            [
              { key: undefined, label: "Todos" },
              { key: "on_time" as const, label: "No prazo" },
              { key: "at_risk" as const, label: "Em risco" },
              { key: "breached" as const, label: "Estourados" },
            ] as const
          ).map((f) => (
            <Button
              key={f.label}
              size="sm"
              variant={bucket === f.key ? "default" : "outline"}
              onClick={() => setBucket(f.key)}
            >
              {f.label}
            </Button>
          ))}
        </div>

        {loadingOrders ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : orders.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum pedido neste filtro.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[10px] uppercase text-muted-foreground">
                  {["Pedido", "Canal", "Cidade", "Status WMS", "Prazo", "Situação"].map((h) => (
                    <th key={h} className="pb-2 pr-4">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {orders.map((o) => (
                  <tr key={o.orderId}>
                    <td className="py-2 pr-4 font-mono text-xs">{o.externalId}</td>
                    <td className="py-2 pr-4">{o.channel}</td>
                    <td className="py-2 pr-4">{o.city ?? "—"}</td>
                    <td className="py-2 pr-4">{o.status}</td>
                    <td className="py-2 pr-4 font-mono text-xs">
                      {new Date(o.slaDeadlineAt).toLocaleString("pt-BR")}
                    </td>
                    <td className="py-2">
                      <StatusPill
                        label={BUCKET_LABEL[o.bucket]?.label ?? o.bucket}
                        tone={BUCKET_LABEL[o.bucket]?.tone ?? "primary"}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel
        title={`Relatório SLA mensal — ${monthlyReport?.month ?? reportMonth}`}
        action={
          <Input
            type="month"
            className="w-40"
            value={reportMonth}
            onChange={(e) => setReportMonth(e.target.value)}
          />
        }
      >
        {loadingReport ? (
          <div className="h-32 animate-pulse rounded-xl bg-muted/40" />
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">
            {(
              [
                { key: "byChannel" as const, title: "Por canal" },
                { key: "byCarrier" as const, title: "Por transportadora" },
                { key: "byRegion" as const, title: "Por região" },
              ] as const
            ).map(({ key, title }) => (
              <div key={key}>
                <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">{title}</p>
                {(monthlyReport?.[key] ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem pedidos</p>
                ) : (
                  <div className="space-y-2">
                    {(monthlyReport?.[key] ?? []).map((row) => (
                      <div
                        key={row.dimensionValue}
                        className="rounded-lg border border-border px-3 py-2 text-sm"
                      >
                        <div className="flex justify-between font-medium">
                          <span>{row.dimensionValue}</span>
                          <span className="font-mono">{row.compliancePercent}%</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {row.total} ped. · {row.breached} estouro(s)
                          {row.avgHoursToDispatch != null && ` · ${row.avgHoursToDispatch}h despacho`}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="Regras por canal">
        {rules.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma regra cadastrada.</p>
        ) : (
          <ul className="mb-4 space-y-2 text-sm">
            {rules.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
                <span className="font-medium capitalize">{r.channel.replace(/_/g, " ")}</span>
                <span className="font-mono text-xs text-muted-foreground">
                  despacho {r.dispatchHours}h · alerta {r.alertHoursBefore}h antes
                  {r.trackingDeadlineHours != null && ` · tracking ${r.trackingDeadlineHours}h`}
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="grid gap-3 sm:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Canal</label>
            <select
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              value={editChannel}
              onChange={(e) => setEditChannel(e.target.value)}
            >
              <option value="">Selecione</option>
              {rules.map((r) => (
                <option key={r.id} value={r.channel}>
                  {r.channel}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Horas despacho</label>
            <Input
              type="number"
              value={dispatchHours}
              onChange={(e) => setDispatchHours(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Alerta antes (h)</label>
            <Input
              type="number"
              value={alertHours}
              onChange={(e) => setAlertHours(Number(e.target.value))}
            />
          </div>
          <div className="flex items-end">
            <Button onClick={handleSaveRule} disabled={upsertRule.isPending} className="w-full">
              Salvar override
            </Button>
          </div>
        </div>
      </Panel>
    </div>
  );
}
