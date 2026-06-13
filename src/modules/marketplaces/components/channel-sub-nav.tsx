import { Link, useRouterState } from '@tanstack/react-router'
import { cn } from '@/lib/utils'

export const CHANNEL_ADVANCED_ROUTES: Record<string, string> = {
  mercado_livre: '/channels/mercado-livre',
  shopee: '/channels/shopee',
  amazon: '/channels/amazon',
  tiktok: '/channels/tiktok',
  nuvemshop: '/channels/lojas',
  shopify: '/channels/lojas',
  instagram: '/channels/instagram',
}

const NAV_ITEMS = [
  { label: 'Overview', to: '/channels', exact: true },
  { label: 'Mercado Livre', to: '/channels/mercado-livre' },
  { label: 'Shopee', to: '/channels/shopee' },
  { label: 'Amazon', to: '/channels/amazon' },
  { label: 'TikTok', to: '/channels/tiktok' },
  { label: 'Lojas', to: '/channels/lojas' },
  { label: 'Instagram', to: '/channels/instagram' },
] as const

export function ChannelSubNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  return (
    <nav className="flex flex-wrap gap-2">
      {NAV_ITEMS.map((item) => {
        const active = item.exact
          ? pathname === item.to
          : pathname === item.to || pathname.startsWith(`${item.to}/`)
        return (
          <Link
            key={item.to}
            to={item.to}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              active
                ? 'border-primary/40 bg-primary/10 text-primary'
                : 'border-border bg-muted/30 text-muted-foreground hover:border-border-strong hover:text-foreground',
            )}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}

export function ChannelOAuthBanner({
  provider,
  label,
}: {
  provider: string
  label?: string
}) {
  return (
    <div className="rounded-lg border border-warning/30 bg-warning/8 px-4 py-3 text-sm">
      <p className="text-foreground">
        {label ?? provider} não conectado. Conecte a integração em{' '}
        <Link to="/clients" className="font-medium text-primary hover:underline">
          Clientes
        </Link>{' '}
        para ver os dados avançados.
      </p>
    </div>
  )
}
