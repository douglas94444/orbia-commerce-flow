import { createFileRoute, Link } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft, Save, ShieldCheck } from 'lucide-react'
import { useEffect } from 'react'
import { PageIntro, Panel } from '@/components/dashboard/panel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useFiscalConfig, useUpsertFiscalConfig, useUploadFiscalCertificate } from '@/modules/fiscal/hooks/use-fiscal'

export const Route = createFileRoute('/_dashboard/fiscal/config')({
  head: () => ({ meta: [{ title: 'Configuração Fiscal — Orbia' }] }),
  component: FiscalConfigPage,
})

const schema = z.object({
  cnpj:        z.string().regex(/^\d{14}$/, 'CNPJ deve ter 14 dígitos sem pontuação'),
  companyName: z.string().min(2, 'Nome da empresa é obrigatório').max(150),
  taxRegime:   z.enum(['simples', 'lucro_presumido', 'lucro_real']),
  defaultCfop: z.string().max(10).optional().nullable(),
  defaultCst:  z.string().max(10).optional().nullable(),
  defaultNcm:  z.string().max(10).optional().nullable(),
})

type FormValues = z.infer<typeof schema>

const TAX_REGIME_OPTIONS = [
  { value: 'simples',           label: 'Simples Nacional' },
  { value: 'lucro_presumido',   label: 'Lucro Presumido' },
  { value: 'lucro_real',        label: 'Lucro Real' },
]

function FiscalConfigPage() {
  const { data: config, isLoading } = useFiscalConfig()
  const { mutate, isPending } = useUpsertFiscalConfig()
  const uploadCert = useUploadFiscalCertificate()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      cnpj:        '',
      companyName: '',
      taxRegime:   'simples',
      defaultCfop: '',
      defaultCst:  '',
      defaultNcm:  '',
    },
  })

  useEffect(() => {
    if (config) {
      reset({
        cnpj:        config.cnpj,
        companyName: config.companyName,
        taxRegime:   config.taxRegime as FormValues['taxRegime'],
        defaultCfop: config.defaultCfop ?? '',
        defaultCst:  config.defaultCst ?? '',
        defaultNcm:  config.defaultNcm ?? '',
      })
    }
  }, [config, reset])

  function onSubmit(values: FormValues) {
    mutate({
      cnpj:        values.cnpj,
      companyName: values.companyName,
      taxRegime:   values.taxRegime,
      defaultCfop: values.defaultCfop || null,
      defaultCst:  values.defaultCst || null,
      defaultNcm:  values.defaultNcm || null,
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          to="/fiscal"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Módulo Fiscal
        </Link>
      </div>

      <PageIntro
        eyebrow="Configuração"
        title="Dados fiscais da empresa"
        description="CNPJ, regime tributário e padrões de emissão de NF-e usados em todos os pedidos."
      />

      {isLoading ? (
        <div className="h-64 animate-pulse rounded-xl bg-muted/40" />
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <Panel title="Identificação da empresa" action={<ShieldCheck className="size-4 text-muted-foreground" />}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="cnpj">CNPJ (apenas números)</Label>
                <Input
                  id="cnpj"
                  placeholder="00000000000100"
                  maxLength={14}
                  {...register('cnpj')}
                />
                {errors.cnpj && <p className="text-xs text-destructive">{errors.cnpj.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="companyName">Razão social</Label>
                <Input
                  id="companyName"
                  placeholder="Empresa Exemplo LTDA"
                  {...register('companyName')}
                />
                {errors.companyName && <p className="text-xs text-destructive">{errors.companyName.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="taxRegime">Regime tributário</Label>
                <select
                  id="taxRegime"
                  className="h-9 w-full rounded-lg border border-input bg-muted/40 px-3 text-sm text-foreground focus:border-primary/50 focus:outline-none"
                  {...register('taxRegime')}
                >
                  {TAX_REGIME_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                {errors.taxRegime && <p className="text-xs text-destructive">{errors.taxRegime.message}</p>}
              </div>
            </div>
          </Panel>

          <Panel title="Padrões de emissão" subtitle="Usados como valores default em novas NF-e. Podem ser sobrescritos por pedido.">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="defaultCfop">CFOP padrão</Label>
                <Input id="defaultCfop" placeholder="5102" maxLength={10} {...register('defaultCfop')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="defaultCst">CST padrão</Label>
                <Input id="defaultCst" placeholder="000" maxLength={10} {...register('defaultCst')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="defaultNcm">NCM padrão</Label>
                <Input id="defaultNcm" placeholder="62044200" maxLength={10} {...register('defaultNcm')} />
              </div>
            </div>
          </Panel>

          <Panel title="Certificado A1" subtitle="Arquivo .pfx armazenado de forma privada no Supabase Storage">
            {config?.certPath || config?.certExpiresAt ? (
              <div className="mb-4 flex items-center gap-3 rounded-lg border border-border bg-muted/20 px-4 py-3">
                <ShieldCheck className="size-5 text-success" />
                <div>
                  <p className="text-sm font-medium text-foreground">Certificado configurado</p>
                  {config.certExpiresAt && (
                    <p className="text-xs text-muted-foreground">
                      Vence em {new Date(config.certExpiresAt).toLocaleDateString('pt-BR')}
                    </p>
                  )}
                </div>
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="certFile">Upload certificado (.pfx)</Label>
              <Input
                id="certFile"
                type="file"
                accept=".pfx,.p12"
                disabled={uploadCert.isPending}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  const reader = new FileReader()
                  reader.onload = () => {
                    const base64 = (reader.result as string).split(',')[1]
                    if (base64) uploadCert.mutate({ fileBase64: base64, fileName: file.name })
                  }
                  reader.readAsDataURL(file)
                }}
              />
            </div>
          </Panel>

          <div className="flex justify-end">
            <Button type="submit" disabled={isPending} className="gap-2">
              <Save className="size-4" />
              {isPending ? 'Salvando…' : 'Salvar configuração'}
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
