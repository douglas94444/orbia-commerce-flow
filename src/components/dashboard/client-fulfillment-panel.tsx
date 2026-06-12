import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Download, Package, Truck, Loader2, Plus, Trash2 } from "lucide-react";
import { Panel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatBRL } from "@/lib/format";
import {
  useClientLogisticsReport,
  useExportClientLogisticsQbr,
  useExportClientLogisticsQbrHtml,
  useExportClientLogisticsQbrPdf,
  useClientSlaRules,
  useUpsertClientSlaRule,
  useClientPackingProfile,
  useUpsertPackingProfile,
} from "@/modules/admin/hooks/use-admin";

interface ClientFulfillmentPanelProps {
  clientId: string;
}

export function ClientFulfillmentPanel({ clientId }: ClientFulfillmentPanelProps) {
  const { data: report, isLoading } = useClientLogisticsReport(clientId);
  const exportQbr = useExportClientLogisticsQbr(clientId);
  const exportQbrHtml = useExportClientLogisticsQbrHtml(clientId);
  const exportQbrPdf = useExportClientLogisticsQbrPdf(clientId);
  const { data: slaRules = [] } = useClientSlaRules(clientId);
  const upsertSla = useUpsertClientSlaRule(clientId);
  const { data: packingProfile } = useClientPackingProfile(clientId);
  const upsertPacking = useUpsertPackingProfile(clientId);

  const [slaChannel, setSlaChannel] = useState("shopify");
  const [dispatchHours, setDispatchHours] = useState(24);
  const [alertHours, setAlertHours] = useState(4);
  const [checklist, setChecklist] = useState<string[]>([]);
  const [brandingUrl, setBrandingUrl] = useState("");
  const [insertSku, setInsertSku] = useState("");

  const clientOverrides = slaRules.filter((r) => r.clientId === clientId);

  function handleExportQbr() {
    exportQbr.mutate(undefined, {
      onSuccess: (res) => {
        const blob = new Blob([res.csv], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `qbr-logistica-${clientId.slice(0, 8)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      },
    });
  }

  function handleExportQbrDeck() {
    exportQbrHtml.mutate(undefined, {
      onSuccess: (res) => {
        const blob = new Blob([res.html], { type: "text/html;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        window.open(url, "_blank");
      },
    });
  }

  function initPackingForm() {
    if (!packingProfile) return;
    setChecklist(packingProfile.checklistItems);
    setBrandingUrl(packingProfile.brandingUrl ?? "");
    setInsertSku(packingProfile.insertMaterialSku ?? "");
  }

  return (
    <div className="space-y-6">
      <Panel
        title="Fulfillly — relatório logístico"
        subtitle="KPIs do mês para QBR e acompanhamento CS"
        action={<Truck className="size-4 text-muted-foreground" />}
      >
        {isLoading ? (
          <div className="h-32 animate-pulse rounded-xl bg-muted/40" />
        ) : !report ? (
          <p className="text-sm text-muted-foreground">Sem dados de fulfillment.</p>
        ) : (
          <>
            <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">Pedidos processados</p>
                <p className="font-mono text-2xl font-bold">
                  {report.billing.ordersProcessed}
                  <span className="text-sm font-normal text-muted-foreground">
                    {" "}/ {report.billing.included}
                  </span>
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">SLA cumprido</p>
                <p className="font-mono text-2xl font-bold text-primary">
                  {report.sla.compliancePercent}%
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Acurácia picking</p>
                <p className="font-mono text-2xl font-bold">
                  {report.analytics.pickingAccuracyPercent}%
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Excedente / cobrança</p>
                <p className="font-mono text-2xl font-bold text-warning">
                  {report.billing.overageOrders}{" "}
                  <span className="text-sm text-muted-foreground">
                    ({formatBRL(report.billing.overageCents / 100)})
                  </span>
                </p>
              </div>
            </div>
            <div className="mb-4 grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-xs text-muted-foreground">Entrega no prazo</p>
                <p className="font-mono text-lg">{report.analytics.onTimeDeliveryPercent}%</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Taxa de incidentes</p>
                <p className="font-mono text-lg">{report.analytics.incidentRatePercent}%</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">SLA em risco / violado</p>
                <p className="font-mono text-lg">
                  {report.sla.atRisk} / {report.sla.breached}
                </p>
              </div>
            </div>
            {report.slaByChannel.length > 0 && (
              <div className="mb-4">
                <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">
                  SLA por canal (mês)
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                        <th className="pb-2">Canal</th>
                        <th className="pb-2">Pedidos</th>
                        <th className="pb-2">Compliance</th>
                        <th className="pb-2">Estouros</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.slaByChannel.map((row) => (
                        <tr key={row.dimensionValue} className="border-b border-border/50">
                          <td className="py-2 capitalize">{row.dimensionValue}</td>
                          <td className="py-2 font-mono">{row.total}</td>
                          <td className="py-2 font-mono">{row.compliancePercent}%</td>
                          <td className="py-2 font-mono">{row.breached}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                className="gap-2"
                disabled={exportQbr.isPending}
                onClick={handleExportQbr}
              >
                {exportQbr.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Download className="size-4" />
                )}
                Exportar CSV QBR
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-2"
                disabled={exportQbrHtml.isPending}
                onClick={handleExportQbrDeck}
              >
                {exportQbrHtml.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Download className="size-4" />
                )}
                QBR deck (HTML)
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-2"
                disabled={exportQbrPdf.isPending}
                onClick={() => exportQbrPdf.mutate()}
              >
                {exportQbrPdf.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Download className="size-4" />
                )}
                QBR PDF
              </Button>
              <Link to="/logistics/analytics">
                <Button size="sm" variant="ghost">
                  Ver analytics logística
                </Button>
              </Link>
            </div>
          </>
        )}
      </Panel>

      <Panel
        title="SLA por loja"
        subtitle="Override de prazo de despacho por canal (staff)"
      >
        {clientOverrides.length > 0 && (
          <ul className="mb-4 space-y-1 text-sm">
            {clientOverrides.map((r) => (
              <li key={r.id} className="font-mono text-xs text-muted-foreground">
                {r.channel}: {r.dispatchHours}h despacho · alerta {r.alertHoursBefore}h antes
              </li>
            ))}
          </ul>
        )}
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Canal</label>
            <Input value={slaChannel} onChange={(e) => setSlaChannel(e.target.value)} />
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
            <label className="mb-1 block text-xs text-muted-foreground">Alerta (h antes)</label>
            <Input
              type="number"
              value={alertHours}
              onChange={(e) => setAlertHours(Number(e.target.value))}
            />
          </div>
        </div>
        <Button
          className="mt-3"
          size="sm"
          disabled={upsertSla.isPending}
          onClick={() =>
            upsertSla.mutate({ channel: slaChannel, dispatchHours, alertHoursBefore: alertHours })
          }
        >
          Salvar regra SLA
        </Button>
      </Panel>

      <Panel
        title="Embalagem personalizada"
        subtitle="Checklist e materiais no packing PWA"
        action={<Package className="size-4 text-muted-foreground" />}
      >
        {checklist.length === 0 && packingProfile && (
          <Button size="sm" variant="outline" className="mb-3" onClick={initPackingForm}>
            Carregar perfil atual
          </Button>
        )}
        {(checklist.length > 0 || packingProfile) && (
          <div className="space-y-3">
            <ul className="space-y-2">
              {(checklist.length ? checklist : packingProfile?.checklistItems ?? []).map(
                (item, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <Input
                      value={item}
                      onChange={(e) => {
                        const next = [...(checklist.length ? checklist : packingProfile!.checklistItems)];
                        next[i] = e.target.value;
                        setChecklist(next);
                      }}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        const base = checklist.length ? checklist : packingProfile!.checklistItems;
                        setChecklist(base.filter((_, j) => j !== i));
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </li>
                ),
              )}
            </ul>
            <Button
              size="sm"
              variant="outline"
              className="gap-1"
              onClick={() =>
                setChecklist([
                  ...(checklist.length ? checklist : packingProfile?.checklistItems ?? []),
                  "",
                ])
              }
            >
              <Plus className="size-3" /> Item
            </Button>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">URL branding</label>
                <Input
                  placeholder="https://..."
                  value={brandingUrl || packingProfile?.brandingUrl || ""}
                  onChange={(e) => setBrandingUrl(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">SKU insert</label>
                <Input
                  placeholder="SKU material"
                  value={insertSku || packingProfile?.insertMaterialSku || ""}
                  onChange={(e) => setInsertSku(e.target.value)}
                />
              </div>
            </div>
            <Button
              size="sm"
              disabled={upsertPacking.isPending}
              onClick={() =>
                upsertPacking.mutate({
                  checklistItems: (checklist.length
                    ? checklist
                    : packingProfile?.checklistItems ?? []
                  ).filter(Boolean),
                  brandingUrl: brandingUrl || null,
                  insertMaterialSku: insertSku || null,
                })
              }
            >
              Salvar embalagem
            </Button>
          </div>
        )}
        {!packingProfile && checklist.length === 0 && (
          <Button size="sm" onClick={initPackingForm}>
            Configurar checklist
          </Button>
        )}
      </Panel>
    </div>
  );
}
