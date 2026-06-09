import { createFileRoute } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { Search, Users, ShieldAlert, Sparkles, Clock } from 'lucide-react'
import { PageIntro, Panel } from '@/components/dashboard/panel'
import { ClientsTable } from '@/components/dashboard/clients-table'
import { KpiCard } from '@/components/dashboard/kpi-card'
import { useClients, usePortfolioStats } from '@/modules/clients/hooks/use-clients'
import { CreateClientDialog } from '@/modules/clients/components/create-client-dialog'
import { healthStatus } from '@/lib/health'

export const Route = createFileRoute('/_dashboard/clients')({
  head: () => ({ meta: [{ title: 'Clientes — Orbia' }] }),
  component: ClientsPage,
})

function ClientsPage() {
  const [query, setQuery] = useState('')
  const { data: clients = [], isLoading } = useClients()
  const { data: stats } = usePortfolioStats()

  const filtered = useMemo(
    () => clients.filter((c) => c.name.toLowerCase().includes(query.toLowerCase())),
    [clients, query],
  )

  // Fall back to computed stats from DB data if portfolio stats not ready
  const healthy    = stats?.healthy    ?? clients.filter((c) => healthStatus(c.healthScore) === 'saudavel').length
  const atRisk     = stats?.atRisk     ?? clients.filter((c) => healthStatus(c.healthScore) === 'risco').length
  const onboarding = stats?.onboarding ?? clients.filter((c) => c.status === 'onboarding').length

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="CRM da agência"
        title="Carteira de clientes"
        description="Pipeline, health score e estágio de onboarding de cada lojista gerenciado pela Orbia."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label="Clientes ativos"
          value={isLoading ? '—' : String(clients.length)}
          icon={Users}
          accent="primary"
        />
        <KpiCard
          label="Saudáveis"
          value={isLoading ? '—' : String(healthy)}
          icon={Sparkles}
          accent="success"
        />
        <KpiCard
          label="Em risco de churn"
          value={isLoading ? '—' : String(atRisk)}
          icon={ShieldAlert}
          accent="warning"
        />
        <KpiCard
          label="Onboarding em curso"
          value={isLoading ? '—' : String(onboarding)}
          hint={onboarding > 0 ? `${onboarding} lojista${onboarding > 1 ? 's' : ''} em implantação` : undefined}
          icon={Clock}
          accent="accent"
        />
      </div>

      <Panel
        title="Todos os clientes"
        action={
          <div className="flex items-center gap-3">
            <div className="relative hidden sm:block">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filtrar por nome…"
                className="h-9 w-52 rounded-lg border border-input bg-muted/40 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground/70 focus:border-primary/50 focus:outline-none"
              />
            </div>
            <CreateClientDialog />
          </div>
        }
      >
        {isLoading ? (
          <TableSkeleton />
        ) : clients.length === 0 ? (
          <EmptyClients />
        ) : (
          <ClientsTable data={filtered} />
        )}
      </Panel>
    </div>
  )
}

function TableSkeleton() {
  return (
    <div className="space-y-3 py-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-12 animate-pulse rounded-lg bg-muted/40" />
      ))}
    </div>
  )
}

function EmptyClients() {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <span className="grid size-14 place-items-center rounded-2xl border border-border bg-muted/40">
        <Users className="size-6 text-muted-foreground" />
      </span>
      <div>
        <p className="font-medium text-foreground">Nenhum cliente cadastrado</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Crie o primeiro cliente para começar a operar.
        </p>
      </div>
      <CreateClientDialog />
    </div>
  )
}
