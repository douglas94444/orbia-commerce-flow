import { createFileRoute } from '@tanstack/react-router'
import { Gauge, HeartPulse, PackageCheck, Truck } from 'lucide-react'
import { PageIntro, Panel } from '@/components/dashboard/panel'
import { KpiCard } from '@/components/dashboard/kpi-card'
import { HealthRing } from '@/components/dashboard/health-ring'
import { PlanBadge } from '@/components/dashboard/plan-badge'
import { formatBRL } from '@/lib/format'
import { useCurrentClient } from '@/modules/clients/hooks/use-current-client'
import { useLogisticsStats } from '@/modules/logistics/hooks/use-logistics'

export const Route = createFileRoute('/portal/overview')({
  head: () => ({ meta: [{ title: 'Minha Loja — Orbia' }] }),
  component: PortalOverviewPage,
})

function PortalOverviewPage() {
  const { data: client, isLoading } = useCurrentClient()
  const { data: logistics } = useLogisticsStats()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        {client && <PlanBadge plan={client.plan} />}
      </div>
      <PageIntro
        eyebrow={client?.clientName ?? 'Carregando…'}
        title="Visão da sua loja"
        description="Acompanhe saúde operacional, GMV e pedidos em tempo real."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Saúde da loja" className="lg:col-span-1">
          <div className="flex flex-col items-center gap-4 py-6">
            {isLoading ? (
              <div className="size-20 animate-pulse rounded-full bg-muted/40" />
            ) : (
              <HealthRing score={client?.healthScore ?? 0} size={96} showLabel />
            )}
          </div>
        </Panel>

        <div className="grid grid-cols-2 gap-4 lg:col-span-2">
          <KpiCard
            label="ROAS"
            value={isLoading ? '—' : client && client.roas > 0 ? `${client.roas.toFixed(1)}x` : '—'}
            icon={Gauge}
            accent="primary"
          />
          <KpiCard
            label="GMV (30d)"
            value={isLoading ? '—' : client && client.gmv30d > 0 ? formatBRL(client.gmv30d, true) : '—'}
            icon={Truck}
            accent="success"
          />
          <KpiCard
            label="Pedidos hoje"
            value={logistics ? String(logistics.todayCount) : '—'}
            icon={PackageCheck}
            accent="accent"
          />
          <KpiCard
            label="Health score"
            value={isLoading ? '—' : client ? `${client.healthScore}/100` : '—'}
            icon={HeartPulse}
            accent="warning"
          />
        </div>
      </div>
    </div>
  )
}
