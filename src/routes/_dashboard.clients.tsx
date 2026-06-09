import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { PageIntro, Panel } from "@/components/dashboard/panel";
import { ClientsTable } from "@/components/dashboard/clients-table";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { clients, healthStatus } from "@/lib/mock/data";
import { Users, ShieldAlert, Sparkles, Clock } from "lucide-react";

export const Route = createFileRoute("/_dashboard/clients")({
  head: () => ({ meta: [{ title: "Clientes — Orbia" }] }),
  component: ClientsPage,
});

function ClientsPage() {
  const [query, setQuery] = useState("");
  const filtered = useMemo(
    () => clients.filter((c) => c.name.toLowerCase().includes(query.toLowerCase())),
    [query],
  );
  const atRisk = clients.filter((c) => healthStatus(c.healthScore) === "risco").length;
  const healthy = clients.filter((c) => healthStatus(c.healthScore) === "saudavel").length;

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="CRM da agência"
        title="Carteira de clientes"
        description="Pipeline, health score e estágio de onboarding de cada lojista gerenciado pela Orbia."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Clientes ativos" value={String(clients.length)} icon={Users} accent="primary" />
        <KpiCard label="Saudáveis" value={String(healthy)} icon={Sparkles} accent="success" />
        <KpiCard label="Em risco de churn" value={String(atRisk)} icon={ShieldAlert} accent="warning" />
        <KpiCard label="Onboarding em curso" value="2" hint="Semana 2 e 3" icon={Clock} accent="accent" />
      </div>

      <Panel
        title="Todos os clientes"
        action={
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filtrar por nome…"
              className="h-9 w-52 rounded-lg border border-input bg-muted/40 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground/70 focus:border-primary/50 focus:outline-none"
            />
          </div>
        }
      >
        <ClientsTable data={filtered} />
      </Panel>
    </div>
  );
}
