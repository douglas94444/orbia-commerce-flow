import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft, Activity, CheckCircle2, XCircle, Clock, Link2, Loader2 } from 'lucide-react'
import { PageIntro, Panel } from '@/components/dashboard/panel'
import { HealthRing } from '@/components/dashboard/health-ring'
import { PlanBadge } from '@/components/dashboard/plan-badge'
import { StatusPill } from '@/components/dashboard/status-pill'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useClientDetail } from '@/modules/clients/hooks/use-clients'
import { useProfile } from '@/modules/auth/hooks/use-profile'
import { ClientCsPanel } from '@/components/dashboard/client-cs-panel'
import { ClientFulfillmentPanel } from '@/components/dashboard/client-fulfillment-panel'
import { AiInsightsPanel } from '@/components/dashboard/ai-insights-panel'
import {
  useStartNuvemshopOAuth,
  useStartShopifyOAuth,
  useStartMercadoLivreOAuth,
  useStartShopeeOAuth,
  useStartMetaOAuth,
  useStartMelhorEnvioOAuth,
  useStartGoogleOAuth,
  useStartWhatsAppOAuth,
  useStartAmazonOAuth,
  useStartTikTokOAuth,
  useStartInstagramOAuth,
} from '@/modules/integrations/hooks/use-oauth'

export const Route = createFileRoute('/_dashboard/clients/$id')({
  head: () => ({ meta: [{ title: 'Detalhe do cliente — Orbia' }] }),
  component: ClientDetailPage,
})

const PROVIDER_LABEL: Record<string, string> = {
  meta:         'Meta Ads',
  google:       'Google Ads',
  mercado_livre: 'Mercado Livre',
  shopify:      'Shopify',
  shopee:       'Shopee',
  amazon:       'Amazon BR',
  tiktok:       'TikTok Shop',
  instagram:    'Instagram Commerce',
  nuvemshop:    'Nuvemshop',
  melhor_envio: 'Melhor Envio',
  whatsapp:     'WhatsApp Business',
}

const MODULE_PROVIDERS: Array<{ label: string; providers: string[] }> = [
  { label: 'Tráfego',    providers: ['meta', 'google'] },
  { label: 'Retenção',   providers: ['whatsapp'] },
  { label: 'Logística',  providers: ['mercado_livre', 'shopify', 'shopee', 'amazon', 'tiktok', 'instagram', 'nuvemshop', 'melhor_envio'] },
  { label: 'Fiscal',     providers: ['focus_nfe'] },
]

const CONNECTABLE = new Set([
  'nuvemshop', 'shopify', 'mercado_livre', 'shopee', 'meta', 'google',
  'melhor_envio', 'whatsapp', 'amazon', 'tiktok', 'instagram',
])

function ClientDetailPage() {
  const { id } = Route.useParams()
  const { data: client, isLoading, error } = useClientDetail(id)
  const { data: profile } = useProfile()
  const nuvemshopOAuth = useStartNuvemshopOAuth()
  const shopifyOAuth = useStartShopifyOAuth()
  const mercadoLivreOAuth = useStartMercadoLivreOAuth()
  const shopeeOAuth = useStartShopeeOAuth()
  const metaOAuth = useStartMetaOAuth()
  const melhorEnvioOAuth = useStartMelhorEnvioOAuth()
  const googleOAuth = useStartGoogleOAuth()
  const whatsappOAuth = useStartWhatsAppOAuth()
  const amazonOAuth = useStartAmazonOAuth()
  const tiktokOAuth = useStartTikTokOAuth()
  const instagramOAuth = useStartInstagramOAuth()
  const [shopDomain, setShopDomain] = useState('')
  const [shopeeShopId, setShopeeShopId] = useState('')
  const [tiktokShopId, setTiktokShopId] = useState('')
  const [instagramPageId, setInstagramPageId] = useState('')

  const isStaff = profile?.role === 'orbia_admin' || profile?.role === 'orbia_staff'

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-muted/40" />
        <div className="grid gap-4 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-xl bg-muted/40" />
          ))}
        </div>
      </div>
    )
  }

  if (error || !client) {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-center">
        <XCircle className="size-10 text-destructive/60" />
        <p className="font-medium text-foreground">Cliente não encontrado</p>
        <Link to="/clients" className="text-sm text-primary hover:underline">
          ← Voltar para clientes
        </Link>
      </div>
    )
  }

  const connectedProviders = new Set(
    client.connections.filter((c) => c.isActive).map((c) => c.provider),
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          to="/clients"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Clientes
        </Link>
        <span className="text-muted-foreground/40">/</span>
        <span className="text-sm text-foreground">{client.name}</span>
      </div>

      <div className="mb-6 flex items-center gap-3">
        <PlanBadge plan={client.plan} />
      </div>
      <PageIntro
        eyebrow={`Segmento: ${client.segment}`}
        title={client.name}
        description="Visão consolidada de saúde, integrações e atividade recente deste cliente."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Health + status */}
        <Panel title="Saúde do cliente">
          <div className="flex flex-col items-center gap-4 py-4">
            <HealthRing score={client.healthScore} size={80} showLabel />
            <div className="grid w-full grid-cols-2 gap-3 text-center">
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <p className="font-mono text-lg font-semibold text-primary">{client.roas.toFixed(1)}x</p>
                <p className="text-[11px] text-muted-foreground">ROAS médio</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <p className="font-mono text-lg font-semibold text-foreground">
                  {client.gmv30d > 0 ? `R$ ${(client.gmv30d / 1000).toFixed(0)}k` : '—'}
                </p>
                <p className="text-[11px] text-muted-foreground">GMV (30d)</p>
              </div>
            </div>
          </div>
        </Panel>

        {/* Integrations status */}
        <Panel title="Integrações conectadas" className="lg:col-span-2">
          <div className="space-y-4">
            {MODULE_PROVIDERS.map((mod) => (
              <div key={mod.label}>
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {mod.label}
                </p>
                <div className="flex flex-wrap gap-2">
                  {mod.providers.map((p) => {
                    const conn = client.connections.find((c) => c.provider === p)
                    const active = connectedProviders.has(p)
                    return (
                      <div
                        key={p}
                        className="flex items-center gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2 text-sm"
                      >
                        {active ? (
                          <CheckCircle2 className="size-3.5 shrink-0 text-success" />
                        ) : (
                          <XCircle className="size-3.5 shrink-0 text-muted-foreground/40" />
                        )}
                        <span className={active ? 'text-foreground' : 'text-muted-foreground/60'}>
                          {PROVIDER_LABEL[p] ?? p}
                        </span>
                        {conn?.externalAccount && (
                          <span className="font-mono text-[10px] text-muted-foreground/60">
                            {conn.externalAccount}
                          </span>
                        )}
                        {!active && isStaff && CONNECTABLE.has(p) && (
                          p === 'shopify' ? (
                            <div className="ml-2 flex items-center gap-1">
                              <Input
                                placeholder="loja.myshopify.com"
                                className="h-7 w-36 text-xs"
                                value={shopDomain}
                                onChange={(e) => setShopDomain(e.target.value)}
                              />
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 gap-1 px-2 text-xs"
                                disabled={!shopDomain || shopifyOAuth.isPending}
                                onClick={() => shopifyOAuth.mutate({ clientId: id, shop: shopDomain })}
                              >
                                {shopifyOAuth.isPending ? <Loader2 className="size-3 animate-spin" /> : <Link2 className="size-3" />}
                                Conectar
                              </Button>
                            </div>
                          ) : p === 'shopee' ? (
                            <div className="ml-2 flex items-center gap-1">
                              <Input
                                placeholder="shop_id"
                                className="h-7 w-24 text-xs"
                                value={shopeeShopId}
                                onChange={(e) => setShopeeShopId(e.target.value)}
                              />
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 gap-1 px-2 text-xs"
                                disabled={!shopeeShopId || shopeeOAuth.isPending}
                                onClick={() => shopeeOAuth.mutate({ clientId: id, shopId: shopeeShopId })}
                              >
                                {shopeeOAuth.isPending ? <Loader2 className="size-3 animate-spin" /> : <Link2 className="size-3" />}
                                Conectar
                              </Button>
                            </div>
                          ) : p === 'tiktok' ? (
                            <div className="ml-2 flex items-center gap-1">
                              <Input
                                placeholder="shop_id"
                                className="h-7 w-24 text-xs"
                                value={tiktokShopId}
                                onChange={(e) => setTiktokShopId(e.target.value)}
                              />
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 gap-1 px-2 text-xs"
                                disabled={!tiktokShopId || tiktokOAuth.isPending}
                                onClick={() => tiktokOAuth.mutate({ clientId: id, shopId: tiktokShopId })}
                              >
                                {tiktokOAuth.isPending ? <Loader2 className="size-3 animate-spin" /> : <Link2 className="size-3" />}
                                Conectar
                              </Button>
                            </div>
                          ) : p === 'instagram' ? (
                            <div className="ml-2 flex items-center gap-1">
                              <Input
                                placeholder="page_id"
                                className="h-7 w-24 text-xs"
                                value={instagramPageId}
                                onChange={(e) => setInstagramPageId(e.target.value)}
                              />
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 gap-1 px-2 text-xs"
                                disabled={!instagramPageId || instagramOAuth.isPending}
                                onClick={() => instagramOAuth.mutate({ clientId: id, pageId: instagramPageId })}
                              >
                                {instagramOAuth.isPending ? <Loader2 className="size-3 animate-spin" /> : <Link2 className="size-3" />}
                                Conectar
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="ml-2 h-7 gap-1 px-2 text-xs"
                              disabled={
                                (p === 'nuvemshop' && nuvemshopOAuth.isPending) ||
                                (p === 'mercado_livre' && mercadoLivreOAuth.isPending) ||
                                (p === 'meta' && metaOAuth.isPending) ||
                                (p === 'melhor_envio' && melhorEnvioOAuth.isPending) ||
                                (p === 'google' && googleOAuth.isPending) ||
                                (p === 'whatsapp' && whatsappOAuth.isPending) ||
                                (p === 'amazon' && amazonOAuth.isPending)
                              }
                              onClick={() => {
                                if (p === 'nuvemshop') nuvemshopOAuth.mutate(id)
                                else if (p === 'mercado_livre') mercadoLivreOAuth.mutate(id)
                                else if (p === 'meta') metaOAuth.mutate(id)
                                else if (p === 'google') googleOAuth.mutate(id)
                                else if (p === 'whatsapp') whatsappOAuth.mutate(id)
                                else if (p === 'melhor_envio') melhorEnvioOAuth.mutate(id)
                                else if (p === 'amazon') amazonOAuth.mutate({ clientId: id })
                              }}
                            >
                              {(p === 'nuvemshop' && nuvemshopOAuth.isPending) ||
                              (p === 'mercado_livre' && mercadoLivreOAuth.isPending) ||
                              (p === 'meta' && metaOAuth.isPending) ||
                              (p === 'melhor_envio' && melhorEnvioOAuth.isPending) ||
                              (p === 'google' && googleOAuth.isPending) ||
                              (p === 'whatsapp' && whatsappOAuth.isPending) ||
                              (p === 'amazon' && amazonOAuth.isPending) ? (
                                <Loader2 className="size-3 animate-spin" />
                              ) : (
                                <Link2 className="size-3" />
                              )}
                              Conectar
                            </Button>
                          )
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {isStaff && (
        <>
          <ClientFulfillmentPanel clientId={id} />
          <ClientCsPanel clientId={id} />
          <AiInsightsPanel clientId={id} />
        </>
      )}

      {/* Recent activity */}
      <Panel
        title="Atividade recente"
        subtitle="Últimas 20 operações de integração"
        action={<Activity className="size-4 text-muted-foreground" />}
      >
        {client.recentActivity.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <Clock className="size-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Nenhuma atividade registrada ainda</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-left">
                  {['Provedor', 'Operação', 'Status', 'Data/Hora'].map((h) => (
                    <th key={h} className="pb-3 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {client.recentActivity.map((a, i) => (
                  <tr key={i} className="transition-colors hover:bg-muted/30">
                    <td className="py-2.5 text-sm text-foreground">{PROVIDER_LABEL[a.provider] ?? a.provider}</td>
                    <td className="py-2.5 font-mono text-xs text-muted-foreground">{a.operation}</td>
                    <td className="py-2.5">
                      <StatusPill
                        label={a.status}
                        tone={a.status === 'success' ? 'success' : a.status === 'error' ? 'danger' : 'neutral'}
                        dot
                      />
                    </td>
                    <td className="py-2.5 font-mono text-xs text-muted-foreground">
                      {new Date(a.createdAt).toLocaleString('pt-BR', {
                        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  )
}
