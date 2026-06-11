import { useState, useEffect } from 'react'
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/integrations/supabase/client'
import { resolveHomePath } from '@/modules/auth/resolve-home'
import { cn } from '@/lib/utils'

async function navigateAfterAuth(navigate: ReturnType<typeof useNavigate>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  navigate({ to: resolveHomePath(profile?.role), replace: true })
}

export const Route = createFileRoute('/login')({
  component: LoginPage,
})

// ─── Schemas ─────────────────────────────────────────────────

const signInSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha mínima de 6 caracteres'),
})

const signUpSchema = z.object({
  fullName: z.string().min(2, 'Nome mínimo de 2 caracteres'),
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha mínima de 6 caracteres'),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Senhas não conferem',
  path: ['confirmPassword'],
})

type SignInValues = z.infer<typeof signInSchema>
type SignUpValues = z.infer<typeof signUpSchema>

// ─── Page ─────────────────────────────────────────────────────

function LoginPage() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const navigate = useNavigate()

  // Redirect already-authenticated users
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) void navigateAfterAuth(navigate)
    })
  }, [navigate])

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="surface-card rounded-xl p-8">
          <div className="mb-8 flex flex-col items-center gap-3">
            <span className="grid size-12 place-items-center rounded-xl bg-primary-gradient text-lg font-bold text-primary-foreground shadow-primary-glow">
              O
            </span>
            <div className="text-center">
              <p className="text-2xl font-bold tracking-tight text-foreground">Orbia</p>
              <p className="text-xs text-muted-foreground">Centro de Operações</p>
            </div>
          </div>

          {/* Mode toggle */}
          <div className="mb-6 flex rounded-xl border border-border bg-muted/30 p-1">
            {(['signin', 'signup'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  'flex-1 rounded-lg py-2 text-sm font-medium transition-colors',
                  mode === m
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {m === 'signin' ? 'Entrar' : 'Criar conta'}
              </button>
            ))}
          </div>

          {mode === 'signin' ? <SignInForm /> : <SignUpForm onSuccess={() => setMode('signin')} />}
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Acesso restrito a membros da equipe Orbia e lojistas cadastrados.
        </p>
      </div>
    </div>
  )
}

// ─── Sign In Form ─────────────────────────────────────────────

function SignInForm() {
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
  })

  const onSubmit = async (values: SignInValues) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    })

    if (error) {
      toast.error(
        error.message === 'Invalid login credentials'
          ? 'Email ou senha incorretos.'
          : error.message,
      )
      return
    }

    await navigateAfterAuth(navigate)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Field label="Email" error={errors.email?.message}>
        <input
          {...register('email')}
          type="email"
          placeholder="seu@email.com"
          autoComplete="email"
          className={inputCn(!!errors.email)}
        />
      </Field>

      <Field label="Senha" error={errors.password?.message}>
        <div className="relative">
          <input
            {...register('password')}
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••"
            autoComplete="current-password"
            className={cn(inputCn(!!errors.password), 'pr-10')}
          />
          <button
            type="button"
            onClick={() => setShowPassword((p) => !p)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </Field>

      <button type="submit" disabled={isSubmitting} className={submitBtnCn}>
        {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
        {isSubmitting ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  )
}

// ─── Sign Up Form ─────────────────────────────────────────────

function SignUpForm({ onSuccess }: { onSuccess: () => void }) {
  const [showPassword, setShowPassword] = useState(false)

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
  })

  const onSubmit = async (values: SignUpValues) => {
    const { error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: { data: { full_name: values.fullName } },
    })

    if (error) {
      toast.error(error.message)
      return
    }

    toast.success('Conta criada! Verifique seu email para confirmar o cadastro.')
    onSuccess()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Field label="Nome completo" error={errors.fullName?.message}>
        <input
          {...register('fullName')}
          type="text"
          placeholder="Seu nome"
          autoComplete="name"
          className={inputCn(!!errors.fullName)}
        />
      </Field>

      <Field label="Email" error={errors.email?.message}>
        <input
          {...register('email')}
          type="email"
          placeholder="seu@email.com"
          autoComplete="email"
          className={inputCn(!!errors.email)}
        />
      </Field>

      <Field label="Senha" error={errors.password?.message}>
        <div className="relative">
          <input
            {...register('password')}
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••"
            autoComplete="new-password"
            className={cn(inputCn(!!errors.password), 'pr-10')}
          />
          <button
            type="button"
            onClick={() => setShowPassword((p) => !p)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </Field>

      <Field label="Confirmar senha" error={errors.confirmPassword?.message}>
        <input
          {...register('confirmPassword')}
          type="password"
          placeholder="••••••••"
          autoComplete="new-password"
          className={inputCn(!!errors.confirmPassword)}
        />
      </Field>

      <button type="submit" disabled={isSubmitting} className={submitBtnCn}>
        {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
        {isSubmitting ? 'Criando conta…' : 'Criar conta'}
      </button>
    </form>
  )
}

// ─── Shared primitives ────────────────────────────────────────

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
    'h-10 w-full rounded-lg border bg-muted/40 px-3 text-sm text-foreground placeholder:text-muted-foreground/60 transition-colors focus:outline-none focus:ring-1',
    hasError
      ? 'border-destructive/50 focus:border-destructive focus:ring-destructive/40'
      : 'border-input focus:border-primary/50 focus:ring-primary/40',
  )

const submitBtnCn =
  'relative mt-2 flex h-10 w-full items-center justify-center gap-2 overflow-hidden rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed'
