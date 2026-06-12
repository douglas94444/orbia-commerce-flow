import { createFileRoute } from '@tanstack/react-router'
import { Banknote, FileCheck2, Gauge, HeartPulse, Truck } from 'lucide-react'
import { KpiCard } from '@/components/dashboard/kpi-card'
import { Panel } from '@/components/dashboard/panel'
import { GmvRoasChart } from '@/components/dashboard/charts'
import { ClientsTable } from '@/components/dashboard/clients-table'
import { useClients, usePortfolioStats } from '@/modules/clients/hooks/use-clients'
import { usePortfolioAnalytics, useNfeCount30d } from '@/modules/analytics/hooks/use-analytics'
import { useSuccessPortfolio } from '@/modules/admin/hooks/use-admin'
import { useProfile } from '@/modules/auth/hooks/use-profile'
import { useMrrStats } from '@/modules/billing/hooks/use-billing'
import { formatBRL } from '@/lib/format'

export const Route = createFileRoute('/_dashboard/overview')({
  head: () => ({ meta: [{ title: 'Visão Geral — Orbia' }] }),
  component: OverviewPage,
})

function OverviewPage() {
  const { data: profile } = useProfile()
  const isStaff = profile?.role === 'orbia_admin' || profile?.role === 'orbia_staff'
  const { data: clients = [], isLoading: loadingClients } = useClients()
  const { data: stats, isLoading: loadingStats } = usePortfolioStats()
  const { data: analytics, isLoading: loadingAnalytics } = usePortfolioAnalytics()
  const { data: nfeCount, isLoading: loadingNfe } = useNfeCount30d()
  const { data: mrrStats, isLoading: loadingMrr } = useMrrStats()
  const { data: csPortfolio } = useSuccessPortfolio({ enabled: isStaff })

  const loading = loadingClients || loadingStats

  const mrr = (mrrStats?.totalMrrCents ?? 0) / 100

  const totalGmv = clients.reduce((sum, c) => sum + c.gmv30d, 0)
  const avgRoas  = stats?.avgRoas ?? 0
  const avgHealth = stats?.avgHealth ?? 0

  const sorted = [...clients].sort((a, b) => b.healthScore - a.healthScore)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 xl:grid-cols-8">
        <KpiCard
          label="MRR atual"
          value={loading || loadingMrr ? '—' : formatBRL(mrr, true)}
          hint="Meta ano 1: R$ 150k/mês"
          icon={Banknote}
          accent="primary"
        />
        <KpiCard
          label="ROAS médio"
          value={loading ? '—' : avgRoas > 0 ? `${avgRoas.toFixed(1)}x` : '—'}
          hint="Meta da carteira: 6,0x"
          icon={Gauge}
          accent="accent"
        />
        <KpiCard
          label="GMV (30d)"
          value={loading ? '—' : totalGmv > 0 ? formatBRL(totalGmv, true) : '—'}
          hint="Volume total da carteira"
          icon={Truck}
          accent="success"
        />
        <KpiCard
          label="Health score"
          value={loading ? '—' : avgHealth > 0 ? `${avgHealth}/100` : '—'}
          hint="Média global da carteira"
          icon={HeartPulse}
          accent="warning"
        />
        <KpiCard
          label="NF emitidas"
          value={loadingNfe ? '—' : String(nfeCount ?? 0)}
          hint="Autorizadas nos últimos 30 dias"
          icon={FileCheck2}
          accent="success"
        />
        <KpiCard
          label="SLA logística"
          value={
            loadingAnalytics
              ? '—'
              : `${analytics?.logistics.slaCompliancePercent ?? 100}%`
          }
          hint="Cumprimento real de despacho"
          icon={Truck}
          accent="primary"
        />
        <KpiCard
          label="Picking"
          value={
            loadingAnalytics
              ? '—'
              : `${analytics?.logistics.pickingAccuracyPercent ?? 100}%`
          }
          hint="Acurácia operacional"
          icon={Gauge}
          accent="accent"
        />
        <KpiCard
          label="Fulfillment mês"
          value={
            loadingAnalytics
              ? '—'
              : String(analytics?.logistics.fulfillmentOrdersMonth ?? 0)
          }
          hint={
            isStaff
              ? `Incidentes médio ${analytics?.logistics.incidentRatePercent ?? 0}%`
              : 'Pedidos processados'
          }
          icon={HeartPulse}
          accent="warning"
        />
      </div>

      {isStaff && (csPortfolio?.staleContactClients ?? 0) > 0 && (
        <div className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-foreground">
          <span className="font-mono font-semibold">{csPortfolio?.staleContactClients}</span>{' '}
          {csPortfolio?.staleContactClients === 1 ? 'cliente' : 'clientes'} sem contato há mais de 14 dias.
        </div>
      )}

      <Panel
        title="Evolução de performance"
        subtitle="GMV vs ROAS — últimos 30 dias"
        action={
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="size-2 rounded-full bg-primary" /> GMV
            </span>
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="size-2 rounded-full bg-success" /> ROAS
            </span>
          </div>
        }
      >
        <GmvRoasChart data={loadingAnalytics ? undefined : analytics?.gmvRoasSeries} />
      </Panel>

      <Panel
        title="Carteira estratégica"
        subtitle="Clientes ordenados por health score"
        action={
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {loadingClients ? '…' : `${clients.length} clientes`}
          </span>
        }
      >
        {loadingClients ? (
          <div className="space-y-3 py-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-muted/40" />
            ))}
          </div>
        ) : (
          <ClientsTable data={sorted} />
        )}
      </Panel>
    </div>
  )
}
