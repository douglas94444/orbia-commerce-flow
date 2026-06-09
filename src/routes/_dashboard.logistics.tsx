import { createFileRoute } from "@tanstack/react-router";
import { Lock, PackageCheck, PackageX, Truck } from "lucide-react";
import { PageIntro, Panel } from "@/components/dashboard/panel";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { StatusPill, type Tone } from "@/components/dashboard/status-pill";
import { inventory, orders } from "@/lib/mock/data";
import { formatBRL } from "@/lib/format";
import type { NfStatus, OrderStatus } from "@/types/orbia";

export const Route = createFileRoute("/_dashboard/logistics")({
  head: () => ({ meta: [{ title: "Logística — Orbia" }] }),
  component: LogisticsPage,
});

const orderStatus: Record<OrderStatus, { label: string; tone: Tone }> = {
  aguardando_nf: { label: "Aguardando NF", tone: "warning" },
  separacao: { label: "Separação", tone: "primary" },
  despachado: { label: "Despachado", tone: "accent" },
  em_transito: { label: "Em trânsito", tone: "accent" },
  entregue: { label: "Entregue", tone: "success" },
};

const nfStatus: Record<NfStatus, { label: string; tone: Tone }> = {
  autorizada: { label: "Autorizada", tone: "success" },
  pendente: { label: "Pendente", tone: "warning" },
  rejeitada: { label: "Rejeitada", tone: "danger" },
};

const invTone: Record<string, Tone> = { ok: "success", atencao: "warning", critico: "danger" };

function LogisticsPage() {
  const awaiting = orders.filter((o) => o.status === "aguardando_nf").length;
  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Módulo Logística"
        title="Hub omnichannel"
        description="Um estoque serve todos os canais. Trava fiscal ativa: nenhum pedido vai para separação sem NF-e autorizada."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Pedidos hoje" value="184" delta={{ value: "12%", positive: true }} icon={PackageCheck} accent="primary" />
        <KpiCard label="Aguardando NF" value={String(awaiting)} hint="Bloqueados pela trava fiscal" icon={Lock} accent="warning" />
        <KpiCard label="SLA no prazo" value="98,2%" icon={Truck} accent="success" />
        <KpiCard label="SKUs críticos" value="2" hint="Estoque ≤ 5 unidades" icon={PackageX} accent="warning" />
      </div>

      <Panel
        title="Pedidos omnichannel"
        action={
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary">
            <Lock className="size-3" /> Trava fiscal ativa
          </span>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="pb-3 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Pedido</th>
                <th className="pb-3 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Cliente</th>
                <th className="pb-3 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Canal</th>
                <th className="pb-3 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Transportadora</th>
                <th className="pb-3 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">NF-e</th>
                <th className="pb-3 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Status</th>
                <th className="pb-3 text-right text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {orders.map((o) => (
                <tr key={o.id} className="transition-colors hover:bg-muted/30">
                  <td className="py-3 font-mono text-xs text-foreground">{o.id}</td>
                  <td className="py-3 text-sm text-foreground">{o.client}</td>
                  <td className="py-3 text-sm text-muted-foreground">{o.channel}</td>
                  <td className="py-3 text-sm text-muted-foreground">{o.carrier}</td>
                  <td className="py-3">
                    <StatusPill label={nfStatus[o.nf].label} tone={nfStatus[o.nf].tone} dot />
                  </td>
                  <td className="py-3">
                    <StatusPill label={orderStatus[o.status].label} tone={orderStatus[o.status].tone} />
                  </td>
                  <td className="py-3 text-right font-mono text-sm text-foreground">{formatBRL(o.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Estoque por SKU" subtitle="Reserva atômica · níveis de alerta">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {inventory.map((item) => (
            <div key={item.sku} className="rounded-xl border border-border bg-muted/20 p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-mono text-xs text-muted-foreground">{item.sku}</span>
                <StatusPill
                  label={item.level === "ok" ? "OK" : item.level === "atencao" ? "Atenção" : "Crítico"}
                  tone={invTone[item.level]}
                  dot
                />
              </div>
              <p className="text-sm font-medium text-foreground">{item.product}</p>
              <p className="text-[11px] text-muted-foreground">{item.client}</p>
              <p className="mt-2 font-mono text-lg font-semibold text-foreground">
                {item.units}
                <span className="ml-1 text-[11px] font-normal text-muted-foreground">un.</span>
              </p>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
