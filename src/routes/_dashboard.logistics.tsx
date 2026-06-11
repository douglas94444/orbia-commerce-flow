import { createFileRoute } from '@tanstack/react-router'
import { Loader2, Lock, PackageCheck, PackageX, Tag, Truck } from 'lucide-react'
import { PageIntro, Panel } from '@/components/dashboard/panel'
import { KpiCard } from '@/components/dashboard/kpi-card'
import { StatusPill, type Tone } from '@/components/dashboard/status-pill'
import { Button } from '@/components/ui/button'
import { formatBRL } from '@/lib/format'
import { Link } from '@tanstack/react-router'
import { useOrders, useInventory, useLogisticsStats, useDispatchOrder } from '@/modules/logistics/hooks/use-logistics'
import { useSlaDashboard, useStockAlerts } from '@/modules/logistics/hooks/use-fulfillly'
import type { NfStatus, OrderStatus } from '@/types/orbia'

export const Route = createFileRoute('/_dashboard/logistics')({
  head: () => ({ meta: [{ title: 'Logística — Orbia' }] }),
  component: LogisticsPage,
})

const ORDER_STATUS: Record<string, { label: string; tone: Tone }> = {
  aguardando_nf: { label: 'Aguardando NF', tone: 'warning' },
  separacao:     { label: 'Separação',     tone: 'primary' },
  em_picking:    { label: 'Picking',       tone: 'primary' },
  em_packing:    { label: 'Packing',       tone: 'primary' },
  despachado:    { label: 'Despachado',    tone: 'accent'  },
  em_transito:   { label: 'Em trânsito',   tone: 'accent'  },
  entregue:      { label: 'Entregue',      tone: 'success' },
  cancelado:     { label: 'Cancelado',     tone: 'danger'  },
  devolvido:     { label: 'Devolvido',     tone: 'danger'  },
}

const NF_STATUS: Record<NfStatus, { label: string; tone: Tone }> = {
  autorizada: { label: 'Autorizada', tone: 'success' },
  pendente:   { label: 'Pendente',   tone: 'warning' },
  rejeitada:  { label: 'Rejeitada',  tone: 'danger'  },
}

const INV_TONE: Record<string, Tone> = { ok: 'success', atencao: 'warning', critico: 'danger' }

function LogisticsPage() {
  const { data: orders = [],    isLoading: loadingOrders    } = useOrders()
  const { data: inventory = [], isLoading: loadingInventory } = useInventory()
  const { data: stats,          isLoading: loadingStats     } = useLogisticsStats()
  const dispatch = useDispatchOrder()
  const { data: sla } = useSlaDashboard()
  const { data: stockAlerts = [] } = useStockAlerts()

  const awaitingNf   = stats?.awaitingNf   ?? orders.filter((o) => o.status === 'aguardando_nf').length
  const todayCount   = stats?.todayCount   ?? 0
  const slaPercent   = stats?.slaPercent   ?? 0
  const criticalSkus = stats?.criticalSkus ?? inventory.filter((i) => i.level === 'critico').length

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Fulfillly"
        title="Hub omnichannel"
        description="WMS + picking + packing + SLA. Trava fiscal ativa: nenhum pedido vai para separação sem NF-e autorizada."
      />
      <div className="mb-6 flex flex-wrap gap-2">
        <Link to="/logistics/products"><Button variant="outline" size="sm">Produtos</Button></Link>
        <Link to="/logistics/warehouse"><Button variant="outline" size="sm">Armazém</Button></Link>
        <Link to="/logistics/inventory"><Button variant="outline" size="sm">Inventário</Button></Link>
        <Link to="/logistics/receiving"><Button variant="outline" size="sm">Recebimento</Button></Link>
        <Link to="/logistics/picking"><Button variant="outline" size="sm">Picking</Button></Link>
        <Link to="/logistics/packing"><Button variant="outline" size="sm">Packing</Button></Link>
        <Link to="/logistics/dispatch"><Button variant="outline" size="sm">Expedição</Button></Link>
        <Link to="/logistics/sla"><Button variant="outline" size="sm">SLA</Button></Link>
        <Link to="/logistics/incidents"><Button variant="outline" size="sm">Incidentes</Button></Link>
        <Link to="/logistics/returns"><Button variant="outline" size="sm">Devoluções</Button></Link>
        <Link to="/logistics/carriers"><Button variant="outline" size="sm">Transportadoras</Button></Link>
        <Link to="/logistics/analytics"><Button variant="outline" size="sm">Analytics</Button></Link>
        <Link to="/logistics/quarantine"><Button variant="outline" size="sm">Quarentena</Button></Link>
        <Link to="/ops"><Button size="sm">App Ops</Button></Link>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Pedidos hoje"    value={loadingStats ? '—' : String(todayCount)}    delta={todayCount > 0 ? undefined : undefined} icon={PackageCheck} accent="primary" />
        <KpiCard label="Aguardando NF"   value={loadingStats ? '—' : String(awaitingNf)}    hint="Bloqueados pela trava fiscal"             icon={Lock}         accent="warning" />
        <KpiCard label="SLA no prazo"    value={loadingStats ? '—' : sla ? `${sla.onTime}/${sla.total}` : slaPercent > 0 ? `${slaPercent}%` : '—'} icon={Truck} accent="success" />
        <KpiCard label="SKUs críticos"   value={loadingStats ? '—' : String(criticalSkus)}  hint="Abaixo do mínimo configurado"              icon={PackageX}     accent="warning" />
      </div>

      {stockAlerts.length > 0 && (
        <Panel title="Alertas de estoque">
          <div className="flex flex-wrap gap-2">
            {stockAlerts.slice(0, 12).map((a) => (
              <span key={a.sku} className="rounded-full border border-warning/30 bg-warning/10 px-3 py-1 text-xs font-mono">
                {a.sku}: {a.available} un. (mín. {a.minStockUnits})
              </span>
            ))}
          </div>
        </Panel>
      )}

      <Panel
        title="Pedidos omnichannel"
        action={
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary">
            <Lock className="size-3" /> Trava fiscal ativa
          </span>
        }
      >
        {loadingOrders ? (
          <RowSkeleton rows={5} />
        ) : orders.length === 0 ? (
          <EmptyState message="Nenhum pedido recebido. Conecte um marketplace para começar." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-left">
                  {['Pedido','Cliente','Canal','Transportadora','NF-e','Status','Valor',''].map((h) => (
                    <th key={h} className={`pb-3 text-[10px] font-medium uppercase tracking-wider text-muted-foreground${h === 'Valor' ? ' text-right' : ''}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {orders.map((o) => (
                  <tr key={o.id} className="transition-colors hover:bg-muted/30">
                    <td className="py-3 font-mono text-xs text-foreground">{o.id}</td>
                    <td className="py-3 text-sm text-foreground">{o.client}</td>
                    <td className="py-3 text-sm text-muted-foreground">{o.channel}</td>
                    <td className="py-3 text-sm text-muted-foreground">{o.carrier}</td>
                    <td className="py-3"><StatusPill label={NF_STATUS[o.nf].label} tone={NF_STATUS[o.nf].tone} dot /></td>
                    <td className="py-3"><StatusPill label={ORDER_STATUS[o.status].label} tone={ORDER_STATUS[o.status].tone} /></td>
                    <td className="py-3 text-right font-mono text-sm text-foreground">{formatBRL(o.value)}</td>
                    <td className="py-3 text-right">
                      {(o.status === 'separacao' || o.status === 'em_packing') && o.nf === 'autorizada' && !o.trackingCode && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 gap-1 px-2 text-xs"
                          disabled={dispatch.isPending}
                          onClick={() => dispatch.mutate(o.internalId)}
                        >
                          {dispatch.isPending ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            <Tag className="size-3" />
                          )}
                          Gerar etiqueta
                        </Button>
                      )}
                      {o.trackingCode && (
                        <span className="font-mono text-[10px] text-muted-foreground">{o.trackingCode}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Estoque por SKU" subtitle="Reserva atômica · níveis de alerta">
        {loadingInventory ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-muted/40" />)}
          </div>
        ) : inventory.length === 0 ? (
          <EmptyState message="Nenhum SKU cadastrado. Importe o estoque inicial para começar." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {inventory.map((item) => (
              <div key={item.sku} className="rounded-xl border border-border bg-muted/20 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-mono text-xs text-muted-foreground">{item.sku}</span>
                  <StatusPill
                    label={item.level === 'ok' ? 'OK' : item.level === 'atencao' ? 'Atenção' : 'Crítico'}
                    tone={INV_TONE[item.level]}
                    dot
                  />
                </div>
                <p className="text-sm font-medium text-foreground">{item.product}</p>
                <p className="text-[11px] text-muted-foreground">{item.client}</p>
                <p className="mt-2 font-mono text-lg font-semibold text-foreground">
                  {item.available}
                  <span className="ml-1 text-[11px] font-normal text-muted-foreground">disp.</span>
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {item.units} total · {item.reserved} reservado
                </p>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  )
}

function RowSkeleton({ rows }: { rows: number }) {
  return (
    <div className="space-y-3 py-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-12 animate-pulse rounded-lg bg-muted/40" />
      ))}
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="py-12 text-center text-sm text-muted-foreground">{message}</div>
  )
}
