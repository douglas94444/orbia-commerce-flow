import { createFileRoute } from '@tanstack/react-router'
import { Banknote } from 'lucide-react'
import { PageIntro, Panel } from '@/components/dashboard/panel'
import { PlanBadge } from '@/components/dashboard/plan-badge'
import { formatBRL } from '@/lib/format'
import { useMrrStats, useSubscriptions, useTransactions, useFulfillmentBilling } from '@/modules/billing/hooks/use-billing'

export const Route = createFileRoute('/_dashboard/billing')({
  head: () => ({ meta: [{ title: 'Billing — Orbia' }] }),
  component: BillingPage,
})

function BillingPage() {
  const { data: mrr, isLoading: loadingMrr } = useMrrStats()
  const { data: subs = [], isLoading: loadingSubs } = useSubscriptions()
  const { data: txs = [], isLoading: loadingTxs } = useTransactions()
  const { data: fulfillment, isLoading: loadingFulfillment } = useFulfillmentBilling()

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Financeiro"
        title="Assinaturas e receita"
        description="MRR real via Mercado Pago e histórico de transações."
        action={<Banknote className="size-5 text-primary" />}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Panel title="MRR total">
          <p className="font-mono text-3xl font-bold text-primary">
            {loadingMrr ? '—' : formatBRL((mrr?.totalMrrCents ?? 0) / 100, true)}
          </p>
        </Panel>
        {(mrr?.byPlan ?? []).map((p) => (
          <Panel key={p.plan} title={`Plano ${p.plan}`}>
            <p className="font-mono text-xl">{p.count} clientes</p>
            <p className="text-sm text-muted-foreground">{formatBRL(p.mrrCents / 100, true)}/mês</p>
          </Panel>
        ))}
      </div>

      <Panel title="Fulfillment — uso do mês" subtitle={fulfillment?.periodMonth ?? undefined}>
        {loadingFulfillment ? (
          <div className="h-24 animate-pulse rounded-xl bg-muted/40" />
        ) : !fulfillment ? (
          <p className="text-sm text-muted-foreground">Sem dados de fulfillment para este cliente.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">Pedidos processados</p>
              <p className="font-mono text-2xl font-bold">
                {fulfillment.ordersProcessed}
                <span className="text-sm font-normal text-muted-foreground">
                  {' '}/ {fulfillment.included} incl.
                </span>
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Excedente</p>
              <p className="font-mono text-2xl font-bold text-warning">{fulfillment.overageOrders}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Cobrança excedente</p>
              <p className="font-mono text-2xl font-bold text-primary">
                {formatBRL(fulfillment.overageCents / 100)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Picks / Packs / Devoluções</p>
              <p className="font-mono text-sm">
                {fulfillment.picksCompleted} / {fulfillment.packsCompleted} / {fulfillment.returnsHandled}
              </p>
            </div>
          </div>
        )}
      </Panel>

      <Panel title="Assinaturas ativas">
        {loadingSubs ? (
          <div className="h-24 animate-pulse rounded-xl bg-muted/40" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                  <th className="pb-2 pr-4">Cliente</th>
                  <th className="pb-2 pr-4">Plano</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2">Valor</th>
                </tr>
              </thead>
              <tbody>
                {subs.map((s) => (
                  <tr key={s.id} className="border-b border-border/50">
                    <td className="py-2 pr-4">{s.clientName}</td>
                    <td className="py-2 pr-4"><PlanBadge plan={s.plan} /></td>
                    <td className="py-2 pr-4 font-mono text-xs">{s.status}</td>
                    <td className="py-2 font-mono">{formatBRL(s.amountBrl)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Transações recentes">
        {loadingTxs ? (
          <div className="h-24 animate-pulse rounded-xl bg-muted/40" />
        ) : (
          <div className="space-y-2">
            {txs.map((t) => (
              <div key={t.id} className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2 text-sm">
                <span>{t.clientName} — {t.description ?? t.type}</span>
                <span className="font-mono">{formatBRL(t.amountBrl)}</span>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  )
}
