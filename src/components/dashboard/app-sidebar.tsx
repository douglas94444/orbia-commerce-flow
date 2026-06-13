import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import type { User } from '@supabase/supabase-js'
import {
  BarChart3,
  Banknote,
  ChevronLeft,
  FileText,
  Handshake,
  Package,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Repeat,
  Settings,
  TrendingUp,
  Truck,
  Users,
  Store,
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
  { label: 'Visão Geral',     to: '/overview',  icon: LayoutDashboard },
  { label: 'Clientes',        to: '/clients',   icon: Users           },
  { label: 'Tráfego',         to: '/traffic',   icon: TrendingUp      },
  { label: 'Logística',       to: '/logistics', icon: Truck           },
  { label: 'Canais',          to: '/channels',  icon: Store           },
  { label: 'Catálogo',        to: '/catalog',   icon: Package         },
  { label: 'Retenção',        to: '/retention', icon: Repeat          },
  { label: 'Billing',         to: '/billing',   icon: Banknote        },
  { label: 'Fiscal',          to: '/fiscal',    icon: FileText        },
  { label: 'Analytics',       to: '/analytics', icon: BarChart3       },
  { label: 'Vendas',          to: '/sales',     icon: Handshake       },
  { label: 'Customer Success',to: '/success',   icon: LifeBuoy        },
  { label: 'Configurações',   to: '/settings',  icon: Settings        },
]

export function AppSidebar({
  collapsed,
  onToggle,
  user,
}: {
  collapsed: boolean
  onToggle: () => void
  user: User | null
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const navigate = useNavigate()

  const displayName =
    user?.user_metadata?.full_name as string | undefined
    ?? user?.email?.split('@')[0]
    ?? 'Usuário'

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
      {/* Header */}
      <div className="flex h-16 items-center gap-3 px-5">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-gradient text-sm font-bold text-primary-foreground shadow-primary-glow">
          O
        </span>
        {!collapsed && (
          <div className="leading-tight">
            <p className="text-lg font-bold tracking-tight text-foreground">Orbia</p>
            <p className="text-xs text-muted-foreground">Centro de Operações</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {nav.map((item) => {
          const active = pathname.startsWith(item.to)
          return (
            <Link
              key={item.to}
              to={item.to}
              title={collapsed ? item.label : undefined}
              className={cn(
                'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-[180ms]',
                active
                  ? 'nav-item-active'
                  : 'text-muted-foreground hover:bg-sidebar-accent/70 hover:text-foreground',
              )}
            >
              <item.icon className={cn('size-[18px] shrink-0', active ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground')} />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          )
        })}
      </nav>

      {/* User + sign out */}
      <div className="border-t border-sidebar-border p-3">
        <div
          className={cn(
            'flex items-center gap-3 rounded-xl bg-sidebar-accent/50 p-2.5',
            collapsed && 'justify-center',
          )}
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-primary/20 bg-primary/10 font-mono text-[11px] font-semibold text-primary">
            {initials}
          </span>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-foreground">{displayName}</p>
              <p className="truncate text-[10px] text-muted-foreground">{user?.email}</p>
            </div>
          )}
          {!collapsed && (
            <button
              onClick={handleSignOut}
              title="Sair"
              className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-destructive"
            >
              <LogOut className="size-4" />
            </button>
          )}
        </div>

        {collapsed && (
          <button
            onClick={handleSignOut}
            title="Sair"
            className="mt-1 flex w-full items-center justify-center rounded-lg py-2 text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-destructive"
          >
            <LogOut className="size-4" />
          </button>
        )}

        <button
          onClick={onToggle}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg py-2 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-foreground"
        >
          <ChevronLeft className={cn('size-4 transition-transform', collapsed && 'rotate-180')} />
          {!collapsed && 'Recolher'}
        </button>
      </div>
    </aside>
  )
}
