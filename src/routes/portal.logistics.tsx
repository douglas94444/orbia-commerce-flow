import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { ExternalLink, Lock } from 'lucide-react'
import { buildTrackingUrl } from '@/modules/logistics/shipping/tracking-link'
import { PageIntro, Panel } from '@/components/dashboard/panel'
import { StatusPill, type Tone } from '@/components/dashboard/status-pill'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatBRL } from '@/lib/format'
import { useOrders, useInventory } from '@/modules/logistics/hooks/use-logistics'
import {
  useSlaDashboard,
  useReturns,
  useCreateReturnRequest,
  useReturnReasonsReport,
} from '@/modules/logistics/hooks/use-fulfillly'
import { KpiCard } from '@/components/dashboard/kpi-card'
import { Truck } from 'lucide-react'
import type { NfStatus, OrderStatus } from '@/types/orbia'

export const Route = createFileRoute('/portal/logistics')({
  head: () => ({ meta: [{ title: 'Logística — Portal Orbia' }] }),
  component: PortalLogisticsPage,
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

const RETURN_STATUS: Record<string, { label: string; tone: Tone }> = {
  pending: { label: 'Pendente', tone: 'warning' },
  approved: { label: 'Aprovada', tone: 'primary' },
  rejected: { label: 'Rejeitada', tone: 'danger' },
  in_transit: { label: 'Em trânsito', tone: 'accent' },
  received: { label: 'Recebida', tone: 'primary' },
  inspected: { label: 'Inspecionada', tone: 'accent' },
  completed: { label: 'Concluída', tone: 'success' },
  cancelled: { label: 'Cancelada', tone: 'danger' },
}

function PortalLogisticsPage() {
  const { data: orders = [], isLoading: loadingOrders } = useOrders()
  const { data: inventory = [], isLoading: loadingInventory } = useInventory()
  const { data: sla, isLoading: loadingSla } = useSlaDashboard()
  const { data: returns = [], isLoading: loadingReturns } = useReturns()
  const { data: reasonReport = [], isLoading: loadingReport } = useReturnReasonsReport()
  const createReturn = useCreateReturnRequest()

  const [orderId, setOrderId] = useState('')
  const [reason, setReason] = useState('')
  const [sku, setSku] = useState('')
  const [qty, setQty] = useState(1)

  const deliverableOrders = orders.filter((o) =>
    ['despachado', 'em_transito', 'entregue'].includes(o.status as OrderStatus),
  )

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Fulfillly"
        title="Pedidos e estoque"
        description="Acompanhe pedidos omnichannel, SLA, devoluções e disponibilidade de SKUs."
      />

      <div className="grid grid-cols-3 gap-4">
        <KpiCard label="SLA no prazo" value={loadingSla ? '—' : `${sla?.onTime ?? 0}/${sla?.total ?? 0}`} icon={Truck} accent="success" />
        <KpiCard label="Em risco" value={loadingSla ? '—' : String(sla?.atRisk ?? 0)} icon={Truck} accent="warning" />
        <KpiCard label="Estourados" value={loadingSla ? '—' : String(sla?.breached ?? 0)} icon={Truck} accent="warning" />
      </div>

      <Panel title="Solicitar devolução" subtitle="Pós-compra — informe o pedido e o motivo">
        <div className="mb-4 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
          <p className="text-muted-foreground">Prefere pelo WhatsApp?</p>
          <a
            href="https://wa.me/?text=Ol%C3%A1%2C%20gostaria%20de%20solicitar%20uma%20devolu%C3%A7%C3%A3o%20do%20meu%20pedido."
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-block font-medium text-primary hover:underline"
          >
            Abrir conversa no WhatsApp
          </a>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Pedido</label>
            <select
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
            >
              <option value="">Selecione...</option>
              {deliverableOrders.map((o) => (
                <option key={o.internalId} value={o.internalId}>
                  {o.id} — {o.channel}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Motivo</label>
            <Input placeholder="Ex.: produto com defeito" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">SKU</label>
            <Input placeholder="SKU do item" value={sku} onChange={(e) => setSku(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Quantidade</label>
            <Input type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} />
          </div>
        </div>
        <Button
          className="mt-4"
          disabled={!orderId || !reason || !sku || createReturn.isPending}
          onClick={() =>
            createReturn.mutate({
              orderId,
              reason,
              items: [{ sku, qty }],
            })
          }
        >
          Enviar solicitação
        </Button>
      </Panel>

      <Panel title="Minhas devoluções">
        {loadingReturns ? (
          <div className="h-24 animate-pulse rounded-lg bg-muted/40" />
        ) : returns.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Nenhuma devolução solicitada.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[10px] uppercase text-muted-foreground">
                  {['ID', 'Motivo', 'Status', 'Reembolso'].map((h) => (
                    <th key={h} className="pb-2 pr-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {returns.map((r: { id: string; reason: string; status: string; refund_cents: number | null }) => {
                  const st = RETURN_STATUS[r.status] ?? { label: r.status, tone: 'primary' as Tone }
                  return (
                    <tr key={r.id}>
                      <td className="py-2 pr-4 font-mono text-xs">{r.id.slice(0, 8)}</td>
                      <td className="py-2 pr-4">{r.reason}</td>
                      <td className="py-2 pr-4"><StatusPill label={st.label} tone={st.tone} /></td>
                      <td className="py-2 font-mono">
                        {r.refund_cents ? formatBRL(r.refund_cents / 100) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Relatório — motivos por SKU e canal">
        {loadingReport ? (
          <div className="h-24 animate-pulse rounded-lg bg-muted/40" />
        ) : reasonReport.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Sem devoluções para agregar.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[10px] uppercase text-muted-foreground">
                  {['Motivo', 'Canal', 'SKU', 'Ocorrências', 'Qtd total'].map((h) => (
                    <th key={h} className="pb-2 pr-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {reasonReport.map((row) => (
                  <tr key={`${row.reason}-${row.channel}-${row.sku}`}>
                    <td className="py-2 pr-4">{row.reason}</td>
                    <td className="py-2 pr-4 text-muted-foreground">{row.channel}</td>
                    <td className="py-2 pr-4 font-mono text-xs">{row.sku}</td>
                    <td className="py-2 pr-4 font-mono">{row.count}</td>
                    <td className="py-2 font-mono">{row.totalQty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

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
                  {['Pedido', 'Canal', 'Status', 'Rastreio', 'NF-e', 'Valor'].map((h) => (
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
                    <td className="py-2 font-mono text-xs">
                      {o.trackingCode ? (
                        <a
                          href={buildTrackingUrl(o.trackingCode, o.carrier)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                        >
                          {o.trackingCode}
                          <ExternalLink className="size-3" />
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
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
