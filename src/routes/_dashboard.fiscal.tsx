import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { Download, FileCheck2, FileWarning, RefreshCw, Settings, ShieldCheck } from 'lucide-react'
import { PageIntro, Panel } from '@/components/dashboard/panel'
import { KpiCard } from '@/components/dashboard/kpi-card'
import { StatusPill, type Tone } from '@/components/dashboard/status-pill'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatBRL } from '@/lib/format'
import {
  useNfEmissions,
  useFiscalStats,
  useRetryNfeEmission,
  useExportNfePeriodCsv,
  useEmitNfce,
  useEmitNfse,
  useEmitNfeForOrder,
  useOrdersAwaitingNf,
} from '@/modules/fiscal/hooks/use-fiscal'
import type { NfStatus } from '@/types/orbia'

export const Route = createFileRoute('/_dashboard/fiscal')({
  head: () => ({ meta: [{ title: 'Fiscal — Orbia' }] }),
  component: FiscalPage,
})

const NF_TONE: Record<NfStatus, { label: string; tone: Tone }> = {
  autorizada: { label: 'Autorizada', tone: 'success' },
  pendente: { label: 'Pendente', tone: 'warning' },
  rejeitada: { label: 'Rejeitada', tone: 'danger' },
  cancelada: { label: 'Cancelada', tone: 'neutral' },
}

function FiscalPage() {
  const { data: emissions = [], isLoading: loadingEmissions } = useNfEmissions()
  const { data: stats, isLoading: loadingStats } = useFiscalStats()
  const retryNfe = useRetryNfeEmission()
  const exportCsv = useExportNfePeriodCsv()
  const emitNfce = useEmitNfce()
  const emitNfse = useEmitNfse()
  const emitNfe = useEmitNfeForOrder()
  const { data: awaitingOrders = [] } = useOrdersAwaitingNf()
  const [orderIdInput, setOrderIdInput] = useState('')
  const [nfseDescription, setNfseDescription] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'NF-e' | 'NFC-e' | 'NFS-e'>('all')

  const filteredEmissions =
    typeFilter === 'all' ? emissions : emissions.filter((e) => e.type === typeFilter)

  const handleExport = () => {
    exportCsv.mutate(30, {
      onSuccess: ({ csv, filename }) => {
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        a.click()
        URL.revokeObjectURL(url)
      },
    })
  }

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Módulo Fiscal"
        title="Emissão de notas fiscais"
        description="NF-e automática por pedido aprovado, com retry em caso de instabilidade da SEFAZ e armazenamento legal por 5 anos."
        action={
          <div className="flex shrink-0 items-center gap-2">
            <Button size="sm" variant="outline" disabled={exportCsv.isPending} onClick={handleExport}>
              <Download className="mr-2 size-4" />
              Exportar período
            </Button>
            <Link to="/fiscal/search">
              <Button size="sm" variant="outline">Consulta</Button>
            </Link>
            <Link to="/fiscal/portal">
              <Button size="sm" variant="outline">Portal contador</Button>
            </Link>
            <Link to="/fiscal/metrics">
              <Button size="sm" variant="outline">Métricas</Button>
            </Link>
            <Link to="/fiscal/services">
              <Button size="sm" variant="outline">Serviços ISS</Button>
            </Link>
            <Link to="/fiscal/config">
              <Button size="sm" variant="outline">
                <Settings className="mr-2 size-4" />
                Configurar
              </Button>
            </Link>
          </div>
        }
      />

      {(stats?.certExpiringSoon || stats?.missingCert || stats?.configIncomplete) && (
        <div className="flex flex-wrap gap-2">
          {stats.configIncomplete && (
            <Link to="/fiscal/config">
              <StatusPill label="Configuração fiscal incompleta — configurar" tone="danger" dot />
            </Link>
          )}
          {stats.missingCert && (
            <StatusPill label="Certificado A1 não cadastrado" tone="danger" dot />
          )}
          {stats.certExpiringSoon && (
            <StatusPill label="Certificado vence em menos de 30 dias" tone="warning" dot />
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        <KpiCard
          label="NF emitidas (30d)"
          value={loadingStats ? '—' : stats ? String(stats.emitted30d) : '—'}
          icon={FileCheck2}
          accent="success"
        />
        <KpiCard
          label="NFC-e (30d)"
          value={loadingStats ? '—' : stats ? String(stats.nfceCount30d ?? 0) : '—'}
          icon={FileCheck2}
        />
        <KpiCard
          label="NFS-e (30d)"
          value={loadingStats ? '—' : stats ? String(stats.nfseCount30d ?? 0) : '—'}
          icon={FileCheck2}
        />
        <KpiCard
          label="NFS-e pendentes"
          value={loadingStats ? '—' : stats ? String(stats.nfsePending ?? 0) : '—'}
          icon={FileWarning}
          accent={stats?.nfsePending ? 'warning' : undefined}
        />
        <KpiCard
          label="Taxa de sucesso"
          value={loadingStats ? '—' : stats && stats.emitted30d > 0 ? `${stats.successRate}%` : '—'}
          hint="Meta: > 99,5%"
          icon={ShieldCheck}
          accent="primary"
        />
        <KpiCard
          label="Em reprocessamento"
          value={loadingStats ? '—' : stats ? String(stats.reprocessing) : '—'}
          hint="Retry automático (máx. 3)"
          icon={RefreshCw}
          accent="warning"
        />
        <KpiCard
          label="Rejeitadas hoje"
          value={loadingStats ? '—' : stats ? String(stats.rejectedToday) : '—'}
          icon={FileWarning}
          accent="warning"
        />
      </div>

      <Panel title="Emissão manual NF-e / NFC-e / NFS-e" subtitle="Informe o UUID do pedido">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">ID do pedido (UUID)</label>
            <Input
              className="w-72 font-mono text-xs"
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              value={orderIdInput}
              onChange={(e) => setOrderIdInput(e.target.value)}
            />
          </div>
          <Button
            size="sm"
            disabled={!orderIdInput || emitNfe.isPending}
            onClick={() => emitNfe.mutate(orderIdInput)}
          >
            Emitir NF-e
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!orderIdInput || emitNfce.isPending}
            onClick={() => emitNfce.mutate(orderIdInput)}
          >
            Emitir NFC-e
          </Button>
          <Input
            className="w-48 text-sm"
            placeholder="Descrição do serviço (NFS-e)"
            value={nfseDescription}
            onChange={(e) => setNfseDescription(e.target.value)}
          />
          <Button
            size="sm"
            variant="outline"
            disabled={!orderIdInput || emitNfse.isPending}
            onClick={() =>
              emitNfse.mutate({
                orderId: orderIdInput,
                serviceDescription: nfseDescription || undefined,
              })
            }
          >
            Emitir NFS-e
          </Button>
        </div>
      </Panel>

      {awaitingOrders.length > 0 && (
        <Panel title="Pedidos aguardando NF-e" subtitle={`${awaitingOrders.length} pedido(s) com NF pendente ou rejeitada`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                  <th className="pb-2 pr-4">Pedido</th>
                  <th className="pb-2 pr-4">Canal</th>
                  <th className="pb-2 pr-4">Valor</th>
                  <th className="pb-2 pr-4">NF status</th>
                  <th className="pb-2">Ação</th>
                </tr>
              </thead>
              <tbody>
                {awaitingOrders.map((o) => (
                  <tr key={o.id} className="border-b border-border/50">
                    <td className="py-2 pr-4 font-mono text-xs">{o.externalId}</td>
                    <td className="py-2 pr-4">{o.channel}</td>
                    <td className="py-2 pr-4 font-mono">{formatBRL(o.valueCents / 100)}</td>
                    <td className="py-2 pr-4">
                      <StatusPill label={o.nfStatus} tone={NF_TONE[o.nfStatus as NfStatus] ?? 'warning'} dot />
                    </td>
                    <td className="py-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        disabled={emitNfe.isPending}
                        onClick={() => emitNfe.mutate(o.id)}
                      >
                        Emitir NF-e
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel
          title="Fila de emissão"
          subtitle="Clique no documento para ver detalhes"
          className="lg:col-span-2"
          action={
            <select
              className="h-8 rounded-lg border border-input bg-muted/40 px-2 text-xs"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
            >
              <option value="all">Todos</option>
              <option value="NF-e">NF-e</option>
              <option value="NFC-e">NFC-e</option>
              <option value="NFS-e">NFS-e</option>
            </select>
          }
        >
          {loadingEmissions ? (
            <div className="space-y-3 py-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-12 animate-pulse rounded-lg bg-muted/40" />
              ))}
            </div>
          ) : filteredEmissions.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Nenhuma NF emitida ainda. As NFs são geradas automaticamente após a aprovação do pedido.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="py-2 pr-3">Documento</th>
                    <th className="py-2 pr-3">Data</th>
                    <th className="py-2 pr-3">Cliente</th>
                    <th className="py-2 pr-3 text-right font-mono">Valor</th>
                    <th className="py-2 pr-3 text-center font-mono">Retry</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredEmissions.map((nf) => (
                    <tr key={nf.emissionId} className="hover:bg-muted/30">
                      <td className="py-2 pr-3">
                        <Link
                          to="/fiscal/$id"
                          params={{ id: nf.emissionId }}
                          className="font-mono text-xs text-primary hover:underline"
                        >
                          {nf.id}
                        </Link>
                      </td>
                      <td className="py-2 pr-3 text-xs text-muted-foreground">
                        {nf.date} {nf.time}
                      </td>
                      <td className="py-2 pr-3">{nf.client}</td>
                      <td className="py-2 pr-3 text-right font-mono">{formatBRL(nf.value)}</td>
                      <td className="py-2 pr-3 text-center font-mono text-xs">{nf.retries}/3</td>
                      <td className="py-2 pr-3">
                        <StatusPill
                          label={NF_TONE[nf.status]?.label ?? nf.status}
                          tone={NF_TONE[nf.status]?.tone ?? 'neutral'}
                          dot
                        />
                      </td>
                      <td className="py-2">
                        {nf.status === 'rejeitada' && nf.retries < 3 && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs"
                            disabled={retryNfe.isPending}
                            onClick={() => retryNfe.mutate(nf.emissionId)}
                          >
                            Reemitir
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel title="Rejeições por motivo" subtitle="Últimos 30 dias">
          {!stats || stats.rejectionReasons.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma rejeição recorrente no período.</p>
          ) : (
            <div className="space-y-2">
              {stats.rejectionReasons.map((r) => (
                <div
                  key={r.reason}
                  className="rounded-lg border border-border/60 px-3 py-2 text-xs"
                >
                  <p className="font-mono text-foreground">{r.count}×</p>
                  <p className="mt-0.5 text-muted-foreground">{r.reason}</p>
                </div>
              ))}
            </div>
          )}
          <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
            Cancelamento de NF permitido em até 24h após autorização. Certificados A1 armazenados em
            bucket privado.
          </p>
        </Panel>
      </div>
    </div>
  )
}
