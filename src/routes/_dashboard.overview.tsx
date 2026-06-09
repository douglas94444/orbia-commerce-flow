import { createFileRoute } from '@tanstack/react-router'
import { motion } from 'framer-motion'
import { Banknote, FileCheck2, Gauge, HeartPulse, Truck } from 'lucide-react'
import { KpiCard } from '@/components/dashboard/kpi-card'
import { Panel } from '@/components/dashboard/panel'
import { GmvRoasChart } from '@/components/dashboard/charts'
import { ClientsTable } from '@/components/dashboard/clients-table'
import { useClients, usePortfolioStats } from '@/modules/clients/hooks/use-clients'
import { usePortfolioAnalytics, useNfeCount30d } from '@/modules/analytics/hooks/use-analytics'
import { formatBRL } from '@/lib/format'

export const Route = createFileRoute('/_dashboard/overview')({
  head: () => ({ meta: [{ title: 'Visão Geral — Orbia' }] }),
  component: OverviewPage,
})

function OverviewPage() {
  const { data: clients = [], isLoading: loadingClients } = useClients()
  const { data: stats, isLoading: loadingStats } = usePortfolioStats()
  const { data: analytics, isLoading: loadingAnalytics } = usePortfolioAnalytics()
  const { data: nfeCount, isLoading: loadingNfe } = useNfeCount30d()

  const loading = loadingClients || loadingStats

  // Aggregate MRR from client plans
  const planMrr: Record<string, number> = { launch: 3500, growth: 9000, scale: 18000 }
  const mrr = clients.reduce((sum, c) => sum + (planMrr[c.plan] ?? 0), 0)

  const totalGmv = clients.reduce((sum, c) => sum + c.gmv30d, 0)
  const avgRoas  = stats?.avgRoas ?? 0
  const avgHealth = stats?.avgHealth ?? 0

  const sorted = [...clients].sort((a, b) => b.healthScore - a.healthScore)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <KpiCard
          label="MRR atual"
          value={loading ? '—' : formatBRL(mrr, true)}
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
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
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
          <GmvRoasChart data={loadingAnalytics ? undefined : analytics?.gmvRoasSeries} />
        </Panel>
      </motion.div>

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
