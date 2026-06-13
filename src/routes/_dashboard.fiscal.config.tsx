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
import { useFiscalConfig, useUpsertFiscalConfig, useUploadFiscalCertificate, useInutilizarNumeracao, useFiscalReadiness, useFiscalSeries, useUpsertFiscalSeries, useUpdateFiscalAutoEmit, useFiscalOnboardingChecklist } from '@/modules/fiscal/hooks/use-fiscal'
import { StatusPill } from '@/components/dashboard/status-pill'

export const Route = createFileRoute('/_dashboard/fiscal/config')({
  head: () => ({ meta: [{ title: 'Configuração Fiscal — Orbia' }] }),
  component: FiscalConfigPage,
})

const schema = z.object({
  cnpj:        z.string().regex(/^\d{14}$/, 'CNPJ deve ter 14 dígitos sem pontuação'),
  companyName: z.string().min(2, 'Nome da empresa é obrigatório').max(150),
  taxRegime:   z.enum(['simples', 'lucro_presumido', 'lucro_real']),
  stateUf:     z.string().length(2, 'UF deve ter 2 letras'),
  stateRegistration: z.string().min(1, 'Inscrição estadual é obrigatória'),
  municipalRegistration: z.string().max(20).optional().nullable(),
  municipalityCode: z.string().max(10).optional().nullable(),
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
  const { data: readiness } = useFiscalReadiness()
  const { mutate, isPending } = useUpsertFiscalConfig()
  const uploadCert = useUploadFiscalCertificate()
  const inutilizar = useInutilizarNumeracao()
  const { data: series = [] } = useFiscalSeries()
  const upsertSeries = useUpsertFiscalSeries()
  const updateAutoEmit = useUpdateFiscalAutoEmit()
  const [autoEmitNfe, setAutoEmitNfe] = useState(true)
  const [autoEmitNfce, setAutoEmitNfce] = useState(false)
  const [autoEmitNfse, setAutoEmitNfse] = useState(false)
  const [nfceCscId, setNfceCscId] = useState('')
  const [nfceCscToken, setNfceCscToken] = useState('')
  const [issRetido, setIssRetido] = useState(false)
  const [naturezaOperacaoNfse, setNaturezaOperacaoNfse] = useState('')
  const [focusEnvironment, setFocusEnvironment] = useState<'homologacao' | 'producao'>('homologacao')
  const { data: onboarding } = useFiscalOnboardingChecklist()
  const [seriesDocType, setSeriesDocType] = useState<'nfe' | 'nfce' | 'nfse'>('nfe')
  const [seriesSerie, setSeriesSerie] = useState('1')
  const [seriesLastNumber, setSeriesLastNumber] = useState('0')
  const [seriesEnv, setSeriesEnv] = useState('homologacao')
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
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      cnpj:        '',
      companyName: '',
      taxRegime:   'simples',
      stateUf:     'SP',
      stateRegistration: '',
      municipalRegistration: '',
      municipalityCode: '',
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
        stateRegistration: config.stateRegistration ?? '',
        municipalRegistration: config.municipalRegistration ?? '',
        municipalityCode: config.municipalityCode ?? '',
        defaultCfop: config.defaultCfop ?? '',
        defaultCst:  config.defaultCst ?? '',
        defaultNcm:  config.defaultNcm ?? '',
      })
      setAutoEmitNfe(config.autoEmitNfe ?? true)
      setAutoEmitNfce(config.autoEmitNfce ?? false)
      setAutoEmitNfse(config.autoEmitNfse ?? false)
      setNfceCscId(config.nfceCscId ?? '')
      setNfceCscToken('')
      setIssRetido(config.issRetido ?? false)
      setNaturezaOperacaoNfse(config.naturezaOperacaoNfse ?? '')
      setFocusEnvironment((config.focusEnvironment as 'homologacao' | 'producao') ?? 'homologacao')
    }
  }, [config, reset])

  const taxRegime = watch('taxRegime')

  function onSubmit(values: FormValues) {
    mutate({
      cnpj:        values.cnpj,
      companyName: values.companyName,
      taxRegime:   values.taxRegime,
      stateUf:     values.stateUf,
      stateRegistration: values.stateRegistration,
      municipalRegistration: values.municipalRegistration || null,
      municipalityCode: values.municipalityCode || null,
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
          {onboarding && (
            <Panel
              title="Checklist semana 1"
              subtitle={onboarding.ready ? 'Pronto para go-live fiscal' : 'Complete antes de emitir em produção'}
            >
              <div className="space-y-2">
                {onboarding.items.map((item) => (
                  <div key={item.key} className="flex items-center justify-between gap-2 text-sm">
                    <span className={item.done ? 'text-foreground' : 'text-muted-foreground'}>
                      {item.done ? '✓' : '○'} {item.label}
                    </span>
                    {item.href && !item.done && (
                      <Link to={item.href} className="text-xs text-primary hover:underline">
                        Configurar
                      </Link>
                    )}
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Cobertura NCM: {onboarding.coveragePct}% dos SKUs ativos
              </p>
            </Panel>
          )}

          <Panel title="Ambiente Focus NFe" subtitle="Homologação não gera documento fiscal válido">
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="focusEnv"
                  checked={focusEnvironment === 'homologacao'}
                  onChange={() => setFocusEnvironment('homologacao')}
                />
                Homologação (testes)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="focusEnv"
                  checked={focusEnvironment === 'producao'}
                  onChange={() => setFocusEnvironment('producao')}
                />
                Produção (SEFAZ real)
              </label>
            </div>
            {focusEnvironment === 'producao' && (
              <p className="mt-2 text-xs text-amber-600">
                Notas emitidas em produção são válidas fiscalmente e não podem ser apagadas — apenas canceladas em até 24h.
              </p>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-4"
              disabled={updateAutoEmit.isPending}
              onClick={() => updateAutoEmit.mutate({ focusEnvironment })}
            >
              Salvar ambiente
            </Button>
          </Panel>

          {readiness && (
            <Panel title="Prontidão para emissão" subtitle={readiness.ready ? 'Tudo pronto para emitir NF-e' : 'Complete os itens abaixo'}>
              <div className="flex flex-wrap gap-2">
                {readiness.items.map((item) => (
                  <StatusPill
                    key={item.key}
                    label={item.label}
                    tone={item.status === 'ok' ? 'success' : item.status === 'warning' ? 'warning' : 'danger'}
                    dot
                  />
                ))}
              </div>
              {!readiness.ready && (
                <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                  {readiness.items
                    .filter((i) => i.status !== 'ok' && i.message)
                    .map((i) => (
                      <li key={i.key}>• {i.label}: {i.message}</li>
                    ))}
                </ul>
              )}
            </Panel>
          )}

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

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="stateRegistration">Inscrição estadual (IE)</Label>
                <Input id="stateRegistration" placeholder="ISENTO ou número da IE" {...register('stateRegistration')} />
                {errors.stateRegistration && <p className="text-xs text-destructive">{errors.stateRegistration.message}</p>}
              </div>
            </div>
          </Panel>

          <Panel title="Dados NFS-e" subtitle="Obrigatórios apenas se emitir nota de serviço">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="municipalRegistration">Inscrição municipal</Label>
                <Input id="municipalRegistration" placeholder="IM" {...register('municipalRegistration')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="municipalityCode">Código município (IBGE)</Label>
                <Input id="municipalityCode" placeholder="3550308" className="font-mono" {...register('municipalityCode')} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="naturezaOperacaoNfse">Natureza da operação NFS-e</Label>
                <Input
                  id="naturezaOperacaoNfse"
                  placeholder="Prestação de serviço"
                  value={naturezaOperacaoNfse}
                  onChange={(e) => setNaturezaOperacaoNfse(e.target.value)}
                />
              </div>
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input type="checkbox" checked={issRetido} onChange={(e) => setIssRetido(e.target.checked)} />
                ISS retido na fonte
              </label>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-4"
              disabled={updateAutoEmit.isPending}
              onClick={() =>
                updateAutoEmit.mutate({
                  issRetido,
                  naturezaOperacaoNfse: naturezaOperacaoNfse || null,
                })
              }
            >
              Salvar parâmetros NFS-e
            </Button>
          </Panel>

          <Panel title="Emissão automática" subtitle="Controla gatilhos por tipo de documento">
            <div className="flex flex-wrap gap-6 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={autoEmitNfe} onChange={(e) => setAutoEmitNfe(e.target.checked)} />
                NF-e automática (e-commerce)
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={autoEmitNfce} onChange={(e) => setAutoEmitNfce(e.target.checked)} />
                NFC-e automática (PDV/balcão)
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={autoEmitNfse} onChange={(e) => setAutoEmitNfse(e.target.checked)} />
                NFS-e automática (serviços/fulfillment)
              </label>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-4"
              disabled={updateAutoEmit.isPending}
              onClick={() =>
                updateAutoEmit.mutate({
                  autoEmitNfe,
                  autoEmitNfce,
                  autoEmitNfse,
                  nfceCscId: nfceCscId || null,
                  nfceCscToken: nfceCscToken || null,
                })
              }
            >
              Salvar preferências de emissão
            </Button>
          </Panel>

          <Panel title="NFC-e (varejo)" subtitle="CSC credenciado na SEFAZ estadual">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="nfceCscId">CSC ID</Label>
                <Input id="nfceCscId" value={nfceCscId} onChange={(e) => setNfceCscId(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nfceCscToken">CSC Token</Label>
                <Input
                  id="nfceCscToken"
                  type="password"
                  placeholder={config?.nfceCscToken ? '••••••••' : 'Token CSC'}
                  value={nfceCscToken}
                  onChange={(e) => setNfceCscToken(e.target.value)}
                />
              </div>
            </div>
          </Panel>

          <Panel title="Séries e numeração" subtitle="Último número emitido por tipo e ambiente">
            {series.length > 0 && (
              <div className="mb-4 space-y-2 text-sm">
                {series.map((s) => (
                  <div key={s.id} className="flex gap-4 font-mono text-xs text-muted-foreground">
                    <span>{s.doc_type.toUpperCase()}</span>
                    <span>série {s.serie}</span>
                    <span>último nº {s.last_number}</span>
                    <span>{s.environment}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <select
                  className="h-9 w-full rounded-lg border border-input bg-muted/40 px-3 text-sm"
                  value={seriesDocType}
                  onChange={(e) => setSeriesDocType(e.target.value as 'nfe' | 'nfce' | 'nfse')}
                >
                  <option value="nfe">NF-e</option>
                  <option value="nfce">NFC-e</option>
                  <option value="nfse">NFS-e</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Ambiente</Label>
                <select
                  className="h-9 w-full rounded-lg border border-input bg-muted/40 px-3 text-sm"
                  value={seriesEnv}
                  onChange={(e) => setSeriesEnv(e.target.value)}
                >
                  <option value="homologacao">Homologação</option>
                  <option value="producao">Produção</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Série</Label>
                <Input value={seriesSerie} onChange={(e) => setSeriesSerie(e.target.value)} maxLength={3} />
              </div>
              <div className="space-y-1.5">
                <Label>Último número</Label>
                <Input type="number" value={seriesLastNumber} onChange={(e) => setSeriesLastNumber(e.target.value)} />
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-4"
              disabled={upsertSeries.isPending}
              onClick={() =>
                upsertSeries.mutate({
                  docType: seriesDocType,
                  serie: seriesSerie,
                  lastNumber: Number(seriesLastNumber),
                  environment: seriesEnv,
                })
              }
            >
              Atualizar série
            </Button>
          </Panel>

          <Panel title="Padrões de emissão" subtitle="Usados como valores default em novas NF-e. Podem ser sobrescritos por pedido.">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="defaultCfop">CFOP padrão</Label>
                <Input id="defaultCfop" placeholder="5102" maxLength={10} {...register('defaultCfop')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="defaultCst">{taxRegime === 'simples' ? 'CSOSN padrão' : 'CST padrão'}</Label>
                <Input
                  id="defaultCst"
                  placeholder={taxRegime === 'simples' ? '102' : '00'}
                  maxLength={10}
                  {...register('defaultCst')}
                />
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
