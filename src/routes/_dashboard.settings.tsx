import { createFileRoute } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useEffect } from 'react'
import { User, Save, Play, Loader2 } from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { runScheduledJobs } from '@/modules/jobs/actions.functions'
import { PageIntro, Panel } from '@/components/dashboard/panel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useProfile, useUpdateProfile } from '@/modules/auth/hooks/use-profile'

export const Route = createFileRoute('/_dashboard/settings')({
  head: () => ({ meta: [{ title: 'Configurações — Orbia' }] }),
  component: SettingsPage,
})

const schema = z.object({
  full_name: z.string().min(2, 'Nome mínimo de 2 caracteres').max(100),
})

type FormValues = z.infer<typeof schema>

const ROLE_LABEL: Record<string, string> = {
  orbia_admin: 'Admin Orbia',
  orbia_staff: 'Equipe Orbia',
  member: 'Lojista',
}

function SettingsPage() {
  const { data: profile, isLoading } = useProfile()
  const { mutate, isPending } = useUpdateProfile()
  const isStaff = profile?.role === 'orbia_admin' || profile?.role === 'orbia_staff'

  const runJobs = useMutation({
    mutationFn: () => runScheduledJobs({ data: { job: 'all' } }),
    onSuccess: (results) => {
      const failed = results.filter((r) => r.status === 'failed').length
      if (failed > 0) {
        toast.warning(`${results.length - failed}/${results.length} jobs concluídos.`)
      } else {
        toast.success('Jobs executados com sucesso.')
      }
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { full_name: '' },
  })

  useEffect(() => {
    if (profile?.full_name) reset({ full_name: profile.full_name })
  }, [profile, reset])

  function onSubmit(values: FormValues) {
    mutate({ full_name: values.full_name })
  }

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Conta"
        title="Configurações do perfil"
        description="Gerencie seu nome de exibição e preferências de conta."
      />

      {isLoading ? (
        <div className="h-48 animate-pulse rounded-xl bg-muted/40" />
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <Panel title="Informações pessoais" action={<User className="size-4 text-muted-foreground" />}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="full_name">Nome completo</Label>
                <Input
                  id="full_name"
                  placeholder="Seu nome"
                  {...register('full_name')}
                />
                {errors.full_name && (
                  <p className="text-xs text-destructive">{errors.full_name.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Função</Label>
                <div className="flex h-9 items-center rounded-lg border border-input bg-muted/20 px-3 text-sm text-muted-foreground">
                  {ROLE_LABEL[profile?.role ?? ''] ?? profile?.role ?? '—'}
                </div>
              </div>
            </div>
          </Panel>

          {isStaff && (
            <Panel title="Jobs agendados" subtitle="Executar sincronizações e recálculos manualmente (dev/staging)">
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                disabled={runJobs.isPending}
                onClick={() => runJobs.mutate()}
              >
                {runJobs.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Play className="size-4" />
                )}
                Executar jobs agora
              </Button>
            </Panel>
          )}

          <div className="flex justify-end">
            <Button type="submit" disabled={isPending} className="gap-2">
              <Save className="size-4" />
              {isPending ? 'Salvando…' : 'Salvar alterações'}
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
