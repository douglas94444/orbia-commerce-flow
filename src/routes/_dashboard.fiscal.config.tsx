import { createFileRoute, Link } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft, Save, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { PageIntro, Panel } from '@/components/dashboard/panel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useFiscalConfig, useUpsertFiscalConfig, useUploadFiscalCertificate, useInutilizarNumeracao } from '@/modules/fiscal/hooks/use-fiscal'

export const Route = createFileRoute('/_dashboard/fiscal/config')({
  head: () => ({ meta: [{ title: 'Configuração Fiscal — Orbia' }] }),
  component: FiscalConfigPage,
})

const schema = z.object({
  cnpj:        z.string().regex(/^\d{14}$/, 'CNPJ deve ter 14 dígitos sem pontuação'),
  companyName: z.string().min(2, 'Nome da empresa é obrigatório').max(150),
  taxRegime:   z.enum(['simples', 'lucro_presumido', 'lucro_real']),
  stateUf:     z.string().length(2, 'UF deve ter 2 letras'),
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

const UF_OPTIONS = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG',
  'PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO',
]

function FiscalConfigPage() {
  const { data: config, isLoading } = useFiscalConfig()
  const { mutate, isPending } = useUpsertFiscalConfig()
  const uploadCert = useUploadFiscalCertificate()
  const inutilizar = useInutilizarNumeracao()
  const [certPassword, setCertPassword] = useState('')
  const [certExpiresAt, setCertExpiresAt] = useState('')
  const [inutSerie, setInutSerie] = useState('1')
  const [inutInicial, setInutInicial] = useState('')
  const [inutFinal, setInutFinal] = useState('')
  const [inutJustificativa, setInutJustificativa] = useState('')

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
      stateUf:     'SP',
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
        stateUf:     config.stateUf ?? 'SP',
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
      stateUf:     values.stateUf,
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

              <div className="space-y-1.5">
                <Label htmlFor="stateUf">UF do emitente</Label>
                <select
                  id="stateUf"
                  className="h-9 w-full rounded-lg border border-input bg-muted/40 px-3 text-sm text-foreground focus:border-primary/50 focus:outline-none"
                  {...register('stateUf')}
                >
                  {UF_OPTIONS.map((uf) => (
                    <option key={uf} value={uf}>{uf}</option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">Define CFOP inter/intraestadual no motor tributário</p>
                {errors.stateUf && <p className="text-xs text-destructive">{errors.stateUf.message}</p>}
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
            {config?.certExpiringSoon && (
              <div className="mb-4 rounded-lg border border-warning/30 bg-warning/8 px-4 py-3 text-sm text-warning">
                Certificado vence em menos de 30 dias — renove antes do prazo.
              </div>
            )}
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
                  {config.hasCertPassword && (
                    <p className="text-xs text-muted-foreground">Senha do PFX cadastrada</p>
                  )}
                </div>
              </div>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2">
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
                      if (base64) {
                        uploadCert.mutate({
                          fileBase64: base64,
                          fileName: file.name,
                          certPassword: certPassword || undefined,
                          certExpiresAt: certExpiresAt
                            ? new Date(certExpiresAt).toISOString()
                            : undefined,
                        })
                      }
                    }
                    reader.readAsDataURL(file)
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="certPassword">Senha do certificado</Label>
                <Input
                  id="certPassword"
                  type="password"
                  placeholder="Senha do arquivo .pfx"
                  value={certPassword}
                  onChange={(e) => setCertPassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="certExpiresAt">Validade do certificado</Label>
                <Input
                  id="certExpiresAt"
                  type="date"
                  value={certExpiresAt}
                  onChange={(e) => setCertExpiresAt(e.target.value)}
                />
              </div>
            </div>
          </Panel>

          <Panel title="Inutilização de numeração" subtitle="Comunica à SEFAZ faixas de numeração não utilizadas">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="inutSerie">Série</Label>
                <Input id="inutSerie" value={inutSerie} onChange={(e) => setInutSerie(e.target.value)} maxLength={3} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="inutInicial">Número inicial</Label>
                <Input id="inutInicial" type="number" value={inutInicial} onChange={(e) => setInutInicial(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="inutFinal">Número final</Label>
                <Input id="inutFinal" type="number" value={inutFinal} onChange={(e) => setInutFinal(e.target.value)} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="inutJustificativa">Justificativa (mín. 15 caracteres)</Label>
                <Input
                  id="inutJustificativa"
                  value={inutJustificativa}
                  onChange={(e) => setInutJustificativa(e.target.value)}
                  placeholder="Faixa de numeração não utilizada por erro de sistema"
                />
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-4"
              disabled={
                inutilizar.isPending ||
                inutJustificativa.trim().length < 15 ||
                !inutInicial ||
                !inutFinal
              }
              onClick={() =>
                inutilizar.mutate({
                  serie: inutSerie,
                  numeroInicial: Number(inutInicial),
                  numeroFinal: Number(inutFinal),
                  justificativa: inutJustificativa.trim(),
                })
              }
            >
              Inutilizar numeração
            </Button>
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
