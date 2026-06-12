import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Gift, Star } from 'lucide-react'
import { PageIntro, Panel } from '@/components/dashboard/panel'
import { StatusPill } from '@/components/dashboard/status-pill'
import { formatNumber } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import {
  getConsumerLoyalty,
  redeemLoyaltyPoints,
  validateAutomationCouponAction,
} from '@/modules/retention/actions.functions'
import { useRegisterDeviceToken } from '@/modules/retention/hooks/use-retention'

const PUSH_STORAGE_KEY = 'orbia_push_device_id'

function PushOptInButton({ customerId }: { customerId?: string }) {
  const { mutate: registerToken, isPending, isSuccess } = useRegisterDeviceToken()
  const [error, setError] = useState(false)

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw-consumer.js').catch(() => null)
    }
  }, [])

  const handleClick = async () => {
    setError(false)
    if ('Notification' in window) {
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') {
        setError(true)
        return
      }
    }
    let token = localStorage.getItem(PUSH_STORAGE_KEY)
    if (!token) {
      token = `web:${crypto.randomUUID()}`
      localStorage.setItem(PUSH_STORAGE_KEY, token)
    }
    registerToken({ token, platform: 'web', customerId })
  }

  if (isSuccess) return <p className="text-xs text-success">Notificações ativadas.</p>
  if (error) return <p className="text-xs text-destructive">Permissão negada.</p>

  return (
    <Button size="sm" variant="outline" disabled={isPending} onClick={handleClick}>
      {isPending ? 'Ativando…' : 'Ativar notificações'}
    </Button>
  )
}

export const Route = createFileRoute('/portal/loyalty')({
  head: () => ({ meta: [{ title: 'Fidelidade — Portal Orbia' }] }),
  component: PortalLoyaltyPage,
})

function PortalLoyaltyPage() {
  const qc = useQueryClient()
  const [redeemPoints, setRedeemPoints] = useState(500)
  const [couponCode, setCouponCode] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['consumer-loyalty'],
    queryFn: () => getConsumerLoyalty(),
  })

  const redeem = useMutation({
    mutationFn: (points: number) =>
      redeemLoyaltyPoints({ data: { customerId: data!.customerId!, points } }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['consumer-loyalty'] })
      toast.success(`Cupom gerado: ${res.couponCode}`)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const validateCoupon = useMutation({
    mutationFn: (code: string) => validateAutomationCouponAction({ data: { code } }),
    onSuccess: (res) => {
      if (res.valid) toast.success(`Cupom válido: ${res.discountPct}% de desconto`)
      else toast.error('Cupom inválido ou expirado')
    },
  })

  const account = data?.account
  const customerId = data?.customerId

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Programa de fidelidade"
        title="Seus pontos Orbia"
        description="Saldo, histórico de movimentações e resgate de recompensas."
      />

      <Panel title="Saldo atual" subtitle="Pontos acumulados na sua conta">
        {isLoading ? (
          <div className="h-20 animate-pulse rounded-xl bg-muted/40" />
        ) : !account ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Nenhuma conta de fidelidade vinculada ao seu e-mail. Faça uma compra para começar a acumular pontos.
          </p>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-mono text-3xl font-semibold">{formatNumber(account.points_balance)}</p>
              <p className="text-xs text-muted-foreground mt-1">pontos disponíveis</p>
            </div>
            <div className="flex items-center gap-2">
              <Star className="size-4 text-primary" />
              <StatusPill label={account.tier} tone="primary" />
              <span className="font-mono text-xs text-muted-foreground">{account.tier_progress_pct}% p/ próximo nível</span>
            </div>
          </div>
        )}
      </Panel>

      {customerId && (
        <Panel title="Notificações push" subtitle="Receba ofertas e atualizações no navegador">
          <PushOptInButton customerId={customerId} />
        </Panel>
      )}

      {account && customerId && (
        <Panel title="Resgatar pontos" subtitle="Mínimo 100 pontos · cupom enviado por WhatsApp">
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <Input
                type="number"
                min={100}
                value={redeemPoints}
                onChange={(e) => setRedeemPoints(Number(e.target.value))}
                className="w-32"
              />
            </div>
            <Button
              disabled={redeem.isPending || redeemPoints < 100}
              onClick={() => redeem.mutate(redeemPoints)}
            >
              <Gift className="size-4 mr-1" />
              Resgatar
            </Button>
          </div>
        </Panel>
      )}

      <Panel title="Validar cupom de automação" subtitle="Cupons recebidos por e-mail ou WhatsApp">
        <div className="flex flex-wrap gap-3">
          <Input
            placeholder="Ex: CARTXXXX"
            value={couponCode}
            onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
            className="max-w-xs font-mono"
          />
          <Button
            variant="secondary"
            disabled={!couponCode || validateCoupon.isPending}
            onClick={() => validateCoupon.mutate(couponCode)}
          >
            Validar cupom
          </Button>
        </div>
      </Panel>

      {data?.transactions?.length ? (
        <Panel title="Histórico" subtitle="Últimas movimentações">
          <div className="divide-y divide-border">
            {data.transactions.map((tx, i) => (
              <div key={i} className="flex justify-between py-2 text-sm">
                <span className="capitalize text-muted-foreground">{tx.type}</span>
                <span className={`font-mono ${tx.points >= 0 ? 'text-success' : 'text-danger'}`}>
                  {tx.points >= 0 ? '+' : ''}{formatNumber(tx.points)}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {new Date(tx.created_at).toLocaleDateString('pt-BR')}
                </span>
              </div>
            ))}
          </div>
        </Panel>
      ) : null}
    </div>
  )
}
