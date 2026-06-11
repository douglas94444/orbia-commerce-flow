import { useEffect } from 'react'
import { useState } from 'react'
import { Outlet, createFileRoute, useRouterState, useNavigate } from '@tanstack/react-router'
import { AppSidebar } from '@/components/dashboard/app-sidebar'
import { TopBar } from '@/components/dashboard/top-bar'
import { AlertsPanel } from '@/components/dashboard/alerts-panel'
import { useSession } from '@/modules/auth/hooks/use-session'
import { useProfile } from '@/modules/auth/hooks/use-profile'
import { isStaffRole } from '@/modules/auth/resolve-home'

export const Route = createFileRoute('/_dashboard')({
  component: DashboardLayout,
})

const titles: Record<string, { title: string; subtitle: string }> = {
  '/overview':  { title: 'Visão Geral',      subtitle: 'Monitoramento da operação em tempo real' },
  '/clients':   { title: 'Clientes',          subtitle: 'Carteira, health score e onboarding' },
  '/traffic':   { title: 'Módulo Tráfego',    subtitle: 'ROAS por canal e diagnóstico de campanhas' },
  '/logistics': { title: 'Módulo Logística',  subtitle: 'Pedidos omnichannel, estoque e trava fiscal' },
  '/retention': { title: 'Módulo Retenção',   subtitle: 'Automações, segmentação RFM e LTV' },
  '/fiscal':    { title: 'Módulo Fiscal',     subtitle: 'Emissão de NF-e e configuração tributária' },
  '/analytics': { title: 'Analytics 360',     subtitle: 'Dados cruzados de todos os módulos' },
  '/success':   { title: 'Customer Success',  subtitle: 'Pipeline, onboarding e NPS da carteira' },
}

function DashboardLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const navigate = useNavigate()
  const { session, user, loading } = useSession()
  const { data: profile, isLoading: loadingProfile } = useProfile()

  useEffect(() => {
    if (!loading && !session) {
      navigate({ to: '/login', replace: true })
    }
  }, [loading, session, navigate])

  useEffect(() => {
    if (!loadingProfile && profile && !isStaffRole(profile.role)) {
      navigate({ to: '/portal/overview', replace: true })
    }
  }, [loadingProfile, profile, navigate])

  const meta =
    Object.entries(titles).find(([k]) => pathname.startsWith(k))?.[1] ?? {
      title: 'Orbia',
      subtitle: 'Centro de operações',
    }

  // Show nothing while checking auth to avoid flash of unauthenticated content
  if (loading || !session || loadingProfile) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <span className="size-8 animate-pulse rounded-full bg-primary/30" />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen w-full bg-background">
      <AppSidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
        user={user}
      />
      <div className="flex min-w-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar title={meta.title} subtitle={meta.subtitle} />
          <main className="flex-1 overflow-y-auto bg-background">
            <div className="mx-auto w-full max-w-[1400px] px-6 py-8">
              <Outlet />
            </div>
          </main>
        </div>
        <AlertsPanel />
      </div>
    </div>
  )
}
