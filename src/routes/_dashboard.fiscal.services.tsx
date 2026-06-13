import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { PageIntro, Panel } from '@/components/dashboard/panel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  useFiscalServices,
  useUpsertFiscalService,
  useDeleteFiscalService,
} from '@/modules/fiscal/hooks/use-fiscal'

export const Route = createFileRoute('/_dashboard/fiscal/services')({
  head: () => ({ meta: [{ title: 'Serviços ISS — Orbia' }] }),
  component: FiscalServicesPage,
})

function FiscalServicesPage() {
  const { data: services = [], isLoading } = useFiscalServices()
  const upsert = useUpsertFiscalService()
  const remove = useDeleteFiscalService()
  const [form, setForm] = useState({
    itemListaServico: '',
    codigoTributacaoMunicipio: '',
    aliquotaIss: '2',
    descricao: '',
    municipalityCode: '',
    isDefault: false,
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    upsert.mutate({
      itemListaServico: form.itemListaServico,
      codigoTributacaoMunicipio: form.codigoTributacaoMunicipio || null,
      aliquotaIss: Number(form.aliquotaIss),
      descricao: form.descricao,
      municipalityCode: form.municipalityCode || null,
      isDefault: form.isDefault,
    })
  }

  return (
    <div className="space-y-6">
      <Link to="/fiscal" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" />
        Módulo Fiscal
      </Link>

      <PageIntro
        eyebrow="NFS-e"
        title="Catálogo de serviços ISS"
        description="Serviços usados na emissão automática de NFS-e (fulfillment, frete, assinatura)."
      />

      <Panel title="Novo serviço">
        <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Item lista serviço (LC 116)</Label>
            <Input
              placeholder="01.01"
              value={form.itemListaServico}
              onChange={(e) => setForm((f) => ({ ...f, itemListaServico: e.target.value }))}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Alíquota ISS (%)</Label>
            <Input
              type="number"
              step="0.01"
              value={form.aliquotaIss}
              onChange={(e) => setForm((f) => ({ ...f, aliquotaIss: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Descrição</Label>
            <Input
              placeholder="Fulfillment e logística"
              value={form.descricao}
              onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Cód. tributação município</Label>
            <Input
              value={form.codigoTributacaoMunicipio}
              onChange={(e) => setForm((f) => ({ ...f, codigoTributacaoMunicipio: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Código município IBGE</Label>
            <Input
              value={form.municipalityCode}
              onChange={(e) => setForm((f) => ({ ...f, municipalityCode: e.target.value }))}
            />
          </div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={form.isDefault}
              onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))}
            />
            Serviço padrão para emissões automáticas
          </label>
          <Button type="submit" disabled={upsert.isPending} className="gap-2 sm:col-span-2 w-fit">
            <Plus className="size-4" />
            Adicionar serviço
          </Button>
        </form>
      </Panel>

      <Panel title="Serviços cadastrados" subtitle={`${services.length} item(ns)`}>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : services.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum serviço cadastrado.</p>
        ) : (
          <div className="space-y-3">
            {services.map((s) => (
              <div
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/20 px-4 py-3"
              >
                <div>
                  <p className="font-medium">
                    {s.descricao}
                    {s.isDefault && (
                      <span className="ml-2 text-xs text-primary">(padrão)</span>
                    )}
                  </p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {s.itemListaServico} · ISS {s.aliquotaIss}%
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => remove.mutate(s.id)}
                  disabled={remove.isPending}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  )
}
