import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useCreateClient } from '../hooks/use-clients'
import type { CreateClientInput } from '../actions.functions'

const schema = z.object({
  name:    z.string().min(2, 'Nome mínimo de 2 caracteres').max(100),
  plan:    z.enum(['launch', 'growth', 'scale']),
  segment: z.string().max(60).optional(),
})

type FormValues = z.infer<typeof schema>

const planLabels: Record<FormValues['plan'], string> = {
  launch: 'Launch — R$ 3.500/mês',
  growth: 'Growth — R$ 9.000/mês',
  scale:  'Scale  — R$ 18.000/mês + % GMV',
}

export function CreateClientDialog() {
  const [open, setOpen] = useState(false)
  const { mutate: create, isPending } = useCreateClient(() => setOpen(false))

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { plan: 'growth' },
  })

  const onSubmit = (values: FormValues) => {
    create(values as CreateClientInput)
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) reset()
    setOpen(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <Plus className="size-4" />
          Novo cliente
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Provisionar novo cliente</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-2 space-y-4">
          {/* Name */}
          <Field label="Nome da empresa" error={errors.name?.message}>
            <input
              {...register('name')}
              placeholder="Ex: Lumina Fashion"
              className={inputCn(!!errors.name)}
            />
          </Field>

          {/* Plan */}
          <Field label="Plano" error={errors.plan?.message}>
            <select {...register('plan')} className={inputCn(!!errors.plan)}>
              {(Object.entries(planLabels) as [FormValues['plan'], string][]).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </Field>

          {/* Segment */}
          <Field label="Segmento (opcional)" error={errors.segment?.message}>
            <input
              {...register('segment')}
              placeholder="Ex: Moda, Eletrônicos, Pet…"
              className={inputCn(!!errors.segment)}
            />
          </Field>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending && <Loader2 className="size-4 animate-spin" />}
              {isPending ? 'Criando…' : 'Criar cliente'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-foreground/80">{label}</label>
      {children}
      {error && <p className="text-[11px] text-destructive">{error}</p>}
    </div>
  )
}

const inputCn = (hasError: boolean) =>
  cn(
    'h-9 w-full rounded-lg border bg-muted/40 px-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 transition-colors',
    hasError
      ? 'border-destructive/50 focus:border-destructive focus:ring-destructive/40'
      : 'border-input focus:border-primary/50 focus:ring-primary/40',
  )
