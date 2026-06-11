import { createFileRoute } from "@tanstack/react-router";
import { PageIntro, Panel } from "@/components/dashboard/panel";
import { useDeliveryIncidents, useStockRupture } from "@/modules/logistics/hooks/use-fulfillly";
import { StatusPill } from "@/components/dashboard/status-pill";

export const Route = createFileRoute("/_dashboard/logistics/incidents")({
  head: () => ({ meta: [{ title: "Incidentes — Fulfillly" }] }),
  component: IncidentsPage,
});

function IncidentsPage() {
  const { data: incidentsData, isLoading } = useDeliveryIncidents();
  const { data: rupture = [] } = useStockRupture();

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Fulfillly"
        title="Incidentes e ruptura"
        description="Problemas de entrega por região e previsão de ruptura de estoque (30 dias)."
      />

      <Panel title="Mapa de calor — incidentes por cidade">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : (incidentsData?.heatMap ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum incidente registrado</p>
        ) : (
          <div className="space-y-2">
            {(incidentsData?.heatMap ?? []).map((p) => (
              <div key={p.city} className="flex items-center justify-between text-sm">
                <span>{p.city}</span>
                <span className="font-mono">{p.count}</span>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="Incidentes recentes">
        <div className="space-y-2">
          {(incidentsData?.incidents ?? []).map((i) => (
            <div
              key={i.id}
              className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
            >
              <div>
                <p className="font-mono text-xs">{i.orderId.slice(0, 8)}</p>
                <p className="text-muted-foreground">{i.incidentType}</p>
              </div>
              <StatusPill
                label={i.resolved ? "Resolvido" : "Aberto"}
                tone={i.resolved ? "success" : "warning"}
              />
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Previsão de ruptura (30d)">
        {rupture.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem SKUs com risco calculado</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[10px] uppercase text-muted-foreground">
                  <th className="pb-2">SKU</th>
                  <th className="pb-2">Disp.</th>
                  <th className="pb-2">Vel./dia</th>
                  <th className="pb-2">Dias</th>
                  <th className="pb-2">Risco</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rupture.slice(0, 20).map((r) => (
                  <tr key={r.sku}>
                    <td className="py-2 font-mono">{r.sku}</td>
                    <td className="py-2 font-mono">{r.currentAvailable}</td>
                    <td className="py-2 font-mono">{r.dailyVelocity.toFixed(1)}</td>
                    <td className="py-2 font-mono">{r.daysUntilRupture ?? "—"}</td>
                    <td className="py-2">
                      <StatusPill
                        label={r.risk}
                        tone={r.risk === "critico" ? "danger" : r.risk === "atencao" ? "warning" : "success"}
                      />
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
