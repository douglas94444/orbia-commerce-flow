import { useEffect, useState } from 'react'
import { Outlet, createFileRoute, useNavigate, useRouterState } from '@tanstack/react-router'
import { PortalSidebar } from '@/components/portal/portal-sidebar'
import { TopBar } from '@/components/dashboard/top-bar'
import { useSession } from '@/modules/auth/hooks/use-session'
import { useProfile } from '@/modules/auth/hooks/use-profile'
import { isStaffRole } from '@/modules/auth/resolve-home'
import { useCurrentClient } from '@/modules/clients/hooks/use-current-client'

export const Route = createFileRoute('/portal')({
  component: PortalLayout,
})

const titles: Record<string, { title: string; subtitle: string }> = {
  '/portal/overview':   { title: 'Minha Loja',        subtitle: 'Performance e saúde da operação' },
  '/portal/logistics':  { title: 'Logística',         subtitle: 'Pedidos e estoque' },
  '/portal/analytics':  { title: 'Analytics',         subtitle: 'Performance da sua loja' },
  '/portal/traffic':    { title: 'Tráfego',           subtitle: 'Campanhas e ROAS' },
  '/portal/retention':  { title: 'Retenção',          subtitle: 'Automações pós-venda' },
  '/portal/settings':   { title: 'Configurações',     subtitle: 'Perfil e equipe' },
}

function PortalLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const navigate = useNavigate()
  const { session, user, loading } = useSession()
  const { data: profile, isLoading: loadingProfile } = useProfile()
  const { data: currentClient } = useCurrentClient()

  useEffect(() => {
    if (!loading && !session) {
      navigate({ to: '/login', replace: true })
    }
  }, [loading, session, navigate])

  useEffect(() => {
    if (!loadingProfile && profile && isStaffRole(profile.role)) {
      navigate({ to: '/overview', replace: true })
    }
  }, [loadingProfile, profile, navigate])

  const meta =
    Object.entries(titles).find(([k]) => pathname.startsWith(k))?.[1] ?? {
      title: 'Portal Orbia',
      subtitle: 'Sua loja',
    }

  if (loading || !session || loadingProfile) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <span className="size-8 animate-pulse rounded-full bg-primary/30" />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen w-full bg-background">
      <PortalSidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
        user={user}
        storeName={currentClient?.clientName}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar title={meta.title} subtitle={meta.subtitle} />
        <main className="flex-1 overflow-y-auto bg-background">
          <div className="mx-auto w-full max-w-[1200px] px-6 py-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
