import { createFileRoute } from "@tanstack/react-router";
import { PageIntro, Panel } from "@/components/dashboard/panel";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { useSlaDashboard } from "@/modules/logistics/hooks/use-fulfillly";
import { Clock, AlertTriangle, CheckCircle } from "lucide-react";

export const Route = createFileRoute("/_dashboard/logistics/sla")({
  head: () => ({ meta: [{ title: "SLA — Fulfillly" }] }),
  component: SlaPage,
});

function SlaPage() {
  const { data, isLoading } = useSlaDashboard();

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Fulfillly"
        title="SLA por canal"
        description="Alertas preventivos e pedidos em risco de estourar prazo de despacho."
      />
      <div className="grid grid-cols-3 gap-4">
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
      </div>
      <Panel title="Regras por canal">
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>Shopee — alerta 4h antes do prazo</li>
          <li>Mercado Livre — alerta 6h antes</li>
          <li>Amazon — alerta 8h antes</li>
        </ul>
      </Panel>
    </div>
  );
}
