import { createFileRoute } from '@tanstack/react-router'
import { Lock } from 'lucide-react'
import { PageIntro, Panel } from '@/components/dashboard/panel'
import { StatusPill, type Tone } from '@/components/dashboard/status-pill'
import { formatBRL } from '@/lib/format'
import { useOrders, useInventory } from '@/modules/logistics/hooks/use-logistics'
import type { NfStatus, OrderStatus } from '@/types/orbia'

export const Route = createFileRoute('/portal/logistics')({
  head: () => ({ meta: [{ title: 'Logística — Portal Orbia' }] }),
  component: PortalLogisticsPage,
})

const ORDER_STATUS: Record<OrderStatus, { label: string; tone: Tone }> = {
  aguardando_nf: { label: 'Aguardando NF', tone: 'warning' },
  separacao:     { label: 'Separação',     tone: 'primary' },
  despachado:    { label: 'Despachado',    tone: 'accent'  },
  em_transito:   { label: 'Em trânsito',   tone: 'accent'  },
  entregue:      { label: 'Entregue',      tone: 'success' },
}

const NF_STATUS: Record<NfStatus, { label: string; tone: Tone }> = {
  autorizada: { label: 'Autorizada', tone: 'success' },
  pendente:   { label: 'Pendente',   tone: 'warning' },
  rejeitada:  { label: 'Rejeitada',  tone: 'danger'  },
}

function PortalLogisticsPage() {
  const { data: orders = [], isLoading: loadingOrders } = useOrders()
  const { data: inventory = [], isLoading: loadingInventory } = useInventory()

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Operação"
        title="Pedidos e estoque"
        description="Acompanhe pedidos omnichannel e disponibilidade de SKUs."
      />

      <Panel
        title="Pedidos"
        action={
          <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-primary">
            <Lock className="size-3" /> Trava fiscal ativa
          </span>
        }
      >
        {loadingOrders ? (
          <div className="h-32 animate-pulse rounded-lg bg-muted/40" />
        ) : orders.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Nenhum pedido ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[10px] uppercase text-muted-foreground">
                  {['Pedido', 'Canal', 'Status', 'NF-e', 'Valor'].map((h) => (
                    <th key={h} className="pb-2">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {orders.map((o) => (
                  <tr key={o.internalId}>
                    <td className="py-2 font-mono text-xs">{o.id}</td>
                    <td className="py-2 text-muted-foreground">{o.channel}</td>
                    <td className="py-2"><StatusPill label={ORDER_STATUS[o.status].label} tone={ORDER_STATUS[o.status].tone} /></td>
                    <td className="py-2"><StatusPill label={NF_STATUS[o.nf].label} tone={NF_STATUS[o.nf].tone} dot /></td>
                    <td className="py-2 font-mono">{formatBRL(o.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Estoque" subtitle="Disponível após reservas">
        {loadingInventory ? (
          <div className="h-24 animate-pulse rounded-lg bg-muted/40" />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {inventory.map((item) => (
              <div key={item.sku} className="rounded-xl border border-border bg-muted/20 p-4">
                <p className="font-mono text-xs text-muted-foreground">{item.sku}</p>
                <p className="font-medium">{item.product}</p>
                <p className="mt-2 font-mono text-lg">{item.available} <span className="text-xs text-muted-foreground">disp.</span></p>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  )
}
