import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import type { User } from '@supabase/supabase-js'
import {
  ChevronLeft,
  LayoutDashboard,
  LogOut,
  Package,
  Repeat,
  Settings,
  TrendingUp,
  Truck,
  type LucideIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/integrations/supabase/client'
import { cn } from '@/lib/utils'

interface NavItem {
  label: string
  to: string
  icon: LucideIcon
}

const nav: NavItem[] = [
  { label: 'Visão Geral', to: '/portal/overview', icon: LayoutDashboard },
  { label: 'Catálogo',    to: '/portal/catalog', icon: Package },
  { label: 'Logística',   to: '/portal/logistics', icon: Truck },
  { label: 'Tráfego',     to: '/portal/traffic', icon: TrendingUp },
  { label: 'Retenção',    to: '/portal/retention', icon: Repeat },
  { label: 'Configurações', to: '/portal/settings', icon: Settings },
]

export function PortalSidebar({
  collapsed,
  onToggle,
  user,
  storeName,
}: {
  collapsed: boolean
  onToggle: () => void
  user: User | null
  storeName?: string
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const navigate = useNavigate()

  const displayName =
    (user?.user_metadata?.full_name as string | undefined)
    ?? user?.email?.split('@')[0]
    ?? 'Lojista'

  const initials = displayName
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) {
      toast.error('Erro ao sair. Tente novamente.')
      return
    }
    navigate({ to: '/login', replace: true })
  }

  return (
    <aside
      className={cn(
        'sticky top-0 z-40 flex h-screen flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-300',
        collapsed ? 'w-[76px]' : 'w-64',
      )}
    >
      <div className="flex h-16 items-center gap-3 px-5">
        <span className="relative grid size-9 shrink-0 place-items-center">
          <span className="absolute inset-0 rounded-full border border-accent/40" />
          <span
            className="size-2.5 rounded-full bg-accent"
            style={{ boxShadow: '0 0 12px var(--accent)' }}
          />
        </span>
        {!collapsed && (
          <div className="leading-tight">
            <p className="font-display text-lg font-bold tracking-tight text-foreground">Orbia</p>
            <p className="truncate text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              {storeName ?? 'Portal Lojista'}
            </p>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {nav.map((item) => {
          const active = pathname.startsWith(item.to)
          return (
            <Link
              key={item.to}
              to={item.to}
              title={collapsed ? item.label : undefined}
              className={cn(
                'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                active
                  ? 'bg-sidebar-accent text-foreground'
                  : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground',
              )}
            >
              <item.icon className={cn('size-5 shrink-0', active && 'text-accent')} />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <div className={cn('flex items-center gap-3 rounded-xl bg-sidebar-accent/50 p-2.5', collapsed && 'justify-center')}>
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-accent/30 to-primary/30 font-mono text-[11px] font-semibold">
            {initials}
          </span>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold">{displayName}</p>
              <p className="truncate text-[10px] text-muted-foreground">{user?.email}</p>
            </div>
          )}
          {!collapsed && (
            <button
              onClick={handleSignOut}
              className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:text-destructive"
            >
              <LogOut className="size-4" />
            </button>
          )}
        </div>
        <button
          onClick={onToggle}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg py-2 text-[11px] text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className={cn('size-4 transition-transform', collapsed && 'rotate-180')} />
          {!collapsed && 'Recolher'}
        </button>
      </div>
    </aside>
  )
}
