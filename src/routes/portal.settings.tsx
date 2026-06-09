import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useEffect } from 'react'
import { User, UserPlus } from 'lucide-react'
import { PageIntro, Panel } from '@/components/dashboard/panel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useProfile, useUpdateProfile } from '@/modules/auth/hooks/use-profile'
import { useCurrentClient } from '@/modules/clients/hooks/use-current-client'
import { inviteClientMember } from '@/modules/clients/actions.functions'
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
