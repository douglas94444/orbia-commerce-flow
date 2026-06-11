import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useEffect } from 'react'
import { User, UserPlus, MessageSquare } from 'lucide-react'
import { useWhatsAppTemplates, useUpdateQuietHours } from '@/modules/retention/hooks/use-retention'
import { PageIntro, Panel } from '@/components/dashboard/panel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useProfile, useUpdateProfile } from '@/modules/auth/hooks/use-profile'
import { useCurrentClient } from '@/modules/clients/hooks/use-current-client'
import { inviteClientMember } from '@/modules/clients/actions.functions'
import { useClientSubscription, useStartMercadoPagoCheckout } from '@/modules/billing/hooks/use-billing'
import { formatBRL } from '@/lib/format'
import { toast } from 'sonner'

export const Route = createFileRoute('/portal/settings')({
  head: () => ({ meta: [{ title: 'Configurações — Portal Orbia' }] }),
  component: PortalSettingsPage,
})

const schema = z.object({
  full_name: z.string().min(2).max(100),
})

const ROLE_LABEL: Record<string, string> = {
  orbia_admin: 'Admin Orbia',
  orbia_staff: 'Equipe Orbia',
  member: 'Lojista',
  owner: 'Proprietário',
  admin: 'Admin da loja',
  manager: 'Gerente',
  viewer: 'Visualizador',
}

function PortalSettingsPage() {
  const { data: profile, isLoading } = useProfile()
  const { data: currentClient } = useCurrentClient()
  const { mutate, isPending } = useUpdateProfile()
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { full_name: '' },
  })

  useEffect(() => {
    if (profile?.full_name) reset({ full_name: profile.full_name })
  }, [profile, reset])

  const canInvite = currentClient && ['owner', 'admin'].includes(currentClient.memberRole)
  const canBilling = canInvite
  const { data: subscription } = useClientSubscription()
  const mpCheckout = useStartMercadoPagoCheckout()
  const { data: waTemplates = [] } = useWhatsAppTemplates()
  const { mutate: saveQuietHours, isPending: savingHours } = useUpdateQuietHours()
  const [quietStart, setQuietStart] = useState(22)
  const [quietEnd, setQuietEnd] = useState(8)

  async function handleInvite() {
    if (!inviteEmail) return
    setInviting(true)
    try {
      await inviteClientMember({ data: { email: inviteEmail, role: 'viewer' } })
      toast.success('Convite enviado.')
      setInviteEmail('')
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setInviting(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Conta"
        title="Configurações"
        description="Perfil, equipe e integrações conectadas pela Orbia."
      />

      {isLoading ? (
        <div className="h-48 animate-pulse rounded-xl bg-muted/40" />
      ) : (
        <form onSubmit={handleSubmit((v) => mutate(v))} className="space-y-6">
          <Panel title="Perfil" action={<User className="size-4 text-muted-foreground" />}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="full_name">Nome</Label>
                <Input id="full_name" {...register('full_name')} />
                {errors.full_name && <p className="text-xs text-destructive">{errors.full_name.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Função</Label>
                <div className="flex h-9 items-center rounded-lg border border-input bg-muted/20 px-3 text-sm text-muted-foreground">
                  {ROLE_LABEL[currentClient?.memberRole ?? profile?.role ?? ''] ?? '—'}
                </div>
              </div>
            </div>
            <Button type="submit" className="mt-4" disabled={isPending}>Salvar</Button>
          </Panel>
        </form>
      )}

      {canBilling && (
        <Panel title="Plano e pagamento" subtitle="Assinatura Orbia via Mercado Pago">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <span className="text-sm">
              Plano atual: <strong>{subscription?.plan ?? currentClient?.plan ?? '—'}</strong>
            </span>
            <span className="font-mono text-xs text-muted-foreground">
              Status: {subscription?.status ?? '—'}
            </span>
            {subscription?.amount_cents ? (
              <span className="font-mono text-sm">{formatBRL(subscription.amount_cents / 100)}/mês</span>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {(['launch', 'growth', 'scale'] as const).map((plan) => (
              <Button
                key={plan}
                type="button"
                variant="outline"
                size="sm"
                disabled={mpCheckout.isPending}
                onClick={() => mpCheckout.mutate(plan)}
              >
                Assinar {plan}
              </Button>
            ))}
          </div>
        </Panel>
      )}

      <Panel title="WhatsApp (Meta)" subtitle="Templates e compliance" action={<MessageSquare className="size-4 text-muted-foreground" />}>
        <p className="mb-3 text-sm text-muted-foreground">
          Clientes que respondem PARAR são removidos automaticamente de todos os fluxos.
        </p>
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label>Início quiet hours (h)</Label>
            <Input type="number" min={0} max={23} value={quietStart} onChange={(e) => setQuietStart(Number(e.target.value))} className="w-24" />
          </div>
          <div className="space-y-1">
            <Label>Fim quiet hours (h)</Label>
            <Input type="number" min={0} max={23} value={quietEnd} onChange={(e) => setQuietEnd(Number(e.target.value))} className="w-24" />
          </div>
          <Button
            type="button"
            size="sm"
            disabled={savingHours}
            onClick={() => saveQuietHours({ quietHoursStart: quietStart, quietHoursEnd: quietEnd })}
          >
            Salvar horário
          </Button>
        </div>
        {waTemplates.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum template registrado. Conecte WhatsApp Business via OAuth.</p>
        ) : (
          <div className="space-y-2">
            {waTemplates.map((t) => (
              <div key={t.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                <span>{t.name}</span>
                <span className="text-xs capitalize text-muted-foreground">{t.status}</span>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="Integrações" subtitle="Conectadas pela equipe Orbia (somente leitura)">
        <div className="flex flex-wrap gap-2">
          {currentClient?.connections.length ? (
            currentClient.connections.map((c) => (
              <span
                key={c.provider}
                className="rounded-lg border border-border bg-muted/20 px-3 py-1.5 text-xs"
              >
                {c.provider} {c.isActive ? '✓' : '—'}
              </span>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">Nenhuma integração ativa.</p>
          )}
        </div>
      </Panel>

      {canInvite && (
        <Panel title="Convidar membro" action={<UserPlus className="size-4 text-muted-foreground" />}>
          <div className="flex gap-2">
            <Input
              placeholder="email@loja.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
            />
            <Button type="button" disabled={inviting || !inviteEmail} onClick={handleInvite}>
              Convidar
            </Button>
          </div>
        </Panel>
      )}
    </div>
  )
}
