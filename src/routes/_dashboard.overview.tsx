import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Banknote, FileCheck2, Gauge, HeartPulse, Truck } from "lucide-react";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { Panel } from "@/components/dashboard/panel";
import { GmvRoasChart } from "@/components/dashboard/charts";
import { ClientsTable } from "@/components/dashboard/clients-table";
import { clients } from "@/lib/mock/data";

export const Route = createFileRoute("/_dashboard/overview")({
  head: () => ({ meta: [{ title: "Visão Geral — Orbia" }] }),
  component: OverviewPage,
});

function OverviewPage() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <KpiCard label="MRR atual" value="R$ 2,48M" delta={{ value: "12,4%", positive: true }} hint="Meta ano 1: R$ 150k/mês" icon={Banknote} accent="primary" />
        <KpiCard label="ROAS médio" value="5,4x" delta={{ value: "2,1%", positive: false }} hint="Meta da carteira: 6,0x" icon={Gauge} accent="accent" />
        <KpiCard label="SLA de entrega" value="98,2%" delta={{ value: "estável", positive: true }} hint="Meta: > 95% no prazo" icon={Truck} accent="success" />
        <KpiCard label="Health score" value="78/100" delta={{ value: "3 pts", positive: true }} hint="Média global da carteira" icon={HeartPulse} accent="warning" />
        <KpiCard label="NF emitidas" value="99,8%" delta={{ value: "0,3%", positive: true }} hint="Meta: > 99,5% de sucesso" icon={FileCheck2} accent="success" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
      >
        <Panel
          title="Evolução de performance"
          subtitle="GMV vs ROAS — últimos 30 dias"
          action={
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                <span className="size-2 rounded-full bg-primary" /> GMV
              </span>
              <span className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                <span className="size-2 rounded-full bg-accent" /> ROAS
              </span>
            </div>
          }
        >
          <GmvRoasChart />
        </Panel>
      </motion.div>

      <Panel
        title="Carteira estratégica"
        subtitle="Clientes ordenados por health score"
        action={
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {clients.length} clientes ativos
          </span>
        }
      >
        <ClientsTable data={[...clients].sort((a, b) => b.healthScore - a.healthScore)} />
      </Panel>
    </div>
  );
}
