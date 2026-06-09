import { createFileRoute } from "@tanstack/react-router";
import { FileCheck2, FileWarning, RefreshCw, ShieldCheck } from "lucide-react";
import { PageIntro, Panel } from "@/components/dashboard/panel";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { StatusPill, type Tone } from "@/components/dashboard/status-pill";
import { nfEmissions } from "@/lib/mock/data";
import { formatBRL } from "@/lib/format";
import type { NfStatus } from "@/types/orbia";

export const Route = createFileRoute("/_dashboard/fiscal")({
  head: () => ({ meta: [{ title: "Fiscal — Orbia" }] }),
  component: FiscalPage,
});

const nfTone: Record<NfStatus, { label: string; tone: Tone }> = {
  autorizada: { label: "Autorizada", tone: "success" },
  pendente: { label: "Pendente", tone: "warning" },
  rejeitada: { label: "Rejeitada", tone: "danger" },
};

function FiscalPage() {
  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Módulo Fiscal"
        title="Emissão de notas fiscais"
        description="NF-e automática por pedido aprovado, com retry em caso de instabilidade da SEFAZ e armazenamento legal por 5 anos."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="NF emitidas (30d)" value="4.821" delta={{ value: "0,3%", positive: true }} icon={FileCheck2} accent="success" />
        <KpiCard label="Taxa de sucesso" value="99,8%" hint="Meta: > 99,5%" icon={ShieldCheck} accent="primary" />
        <KpiCard label="Em reprocessamento" value="3" hint="Retry automático (máx. 3)" icon={RefreshCw} accent="warning" />
        <KpiCard label="Rejeitadas hoje" value="1" icon={FileWarning} accent="warning" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Fila de emissão" subtitle="Tempo real · retorno SEFAZ" className="lg:col-span-2">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-3 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Documento</th>
                  <th className="pb-3 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Cliente</th>
                  <th className="pb-3 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Tipo</th>
                  <th className="pb-3 text-right text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Valor</th>
                  <th className="pb-3 text-center text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Retry</th>
                  <th className="pb-3 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {nfEmissions.map((nf) => (
                  <tr key={nf.id} className="transition-colors hover:bg-muted/30">
                    <td className="py-3 font-mono text-xs text-foreground">{nf.id}</td>
                    <td className="py-3 text-sm text-foreground">{nf.client}</td>
                    <td className="py-3 text-sm text-muted-foreground">{nf.type}</td>
                    <td className="py-3 text-right font-mono text-sm text-foreground">{formatBRL(nf.value)}</td>
                    <td className="py-3 text-center font-mono text-xs text-muted-foreground">{nf.retries}/3</td>
                    <td className="py-3">
                      <StatusPill label={nfTone[nf.status].label} tone={nfTone[nf.status].tone} dot />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Status SEFAZ" subtitle="Por unidade federativa">
          <div className="space-y-3">
            {[
              { uf: "SP", status: "Instável", tone: "warning" as const },
              { uf: "RJ", status: "Operacional", tone: "success" as const },
              { uf: "MG", status: "Operacional", tone: "success" as const },
              { uf: "RS", status: "Operacional", tone: "success" as const },
              { uf: "PE", status: "Operacional", tone: "success" as const },
            ].map((s) => (
              <div key={s.uf} className="flex items-center justify-between rounded-lg border border-border bg-muted/20 px-4 py-2.5">
                <span className="font-mono text-sm font-semibold text-foreground">SEFAZ-{s.uf}</span>
                <StatusPill label={s.status} tone={s.tone} dot />
              </div>
            ))}
            <p className="pt-2 text-[11px] leading-relaxed text-muted-foreground">
              Cancelamento de NF permitido em até 24h. Certificados A1 armazenados criptografados.
            </p>
          </div>
        </Panel>
      </div>
    </div>
  );
}
