import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { ArrowLeft, Download, ExternalLink, FileEdit, RefreshCw, XCircle } from 'lucide-react'
import { PageIntro, Panel } from '@/components/dashboard/panel'
import { StatusPill, type Tone } from '@/components/dashboard/status-pill'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { formatBRL } from '@/lib/format'
import {
  useNfeEmissionDetail,
  useRetryNfeEmission,
  useCancelNfeEmission,
  useCartaCorrecaoNfe,
  useNfeFiscalEvents,
  useNfeXmlDownload,
} from '@/modules/fiscal/hooks/use-fiscal'
import type { NfStatus } from '@/types/orbia'

export const Route = createFileRoute('/_dashboard/fiscal/$id')({
  head: () => ({ meta: [{ title: 'Detalhe NF — Orbia' }] }),
  component: NfeDetailPage,
})

const NF_TONE: Record<NfStatus, Tone> = {
  autorizada: 'success',
  pendente: 'warning',
  rejeitada: 'danger',
  cancelada: 'neutral',
}

function NfeDetailPage() {
  const { id } = Route.useParams()
  const { data: nf, isLoading } = useNfeEmissionDetail(id)
  const retryNfe = useRetryNfeEmission()
  const cancelNfe = useCancelNfeEmission()
  const cartaCorrecao = useCartaCorrecaoNfe()
  const xmlDownload = useNfeXmlDownload()
  const [justificativa, setJustificativa] = useState('')
  const [correcao, setCorrecao] = useState('')

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Carregando…</p>
  }

  if (!nf) {
    return (
      <div className="space-y-4">
        <Link to="/fiscal" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" />
          Voltar
        </Link>
        <p className="text-sm text-muted-foreground">Emissão não encontrada.</p>
      </div>
    )
  }

  const canRetry = nf.status === 'rejeitada' && nf.retries < 3
  const { data: events = [] } = useNfeFiscalEvents(nf.emissionId)

  return (
    <div className="space-y-6">
      <Link to="/fiscal" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" />
        Módulo Fiscal
      </Link>

      <PageIntro
        eyebrow="NF-e"
        title={`Documento ${nf.id}`}
        description={`${nf.type} · ${nf.client} · ${nf.date} ${nf.time}`}
      />

      <div className="flex flex-wrap items-center gap-3">
        <StatusPill label={nf.status} tone={NF_TONE[nf.status]} dot />
        <span className="font-mono text-lg font-semibold">{formatBRL(nf.value)}</span>
        <span className="text-xs text-muted-foreground">Tentativas: {nf.retries}/3</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Panel title="Identificação">
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Chave de acesso</dt>
              <dd className="font-mono text-xs break-all">{nf.accessKey ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Referência Focus</dt>
              <dd className="font-mono text-xs">{nf.externalRef ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Pedido vinculado</dt>
              <dd className="font-mono text-xs">{nf.orderId ?? '—'}</dd>
            </div>
            {nf.authorizedAt && (
              <div>
                <dt className="text-xs text-muted-foreground">Autorizada em</dt>
                <dd>{new Date(nf.authorizedAt).toLocaleString('pt-BR')}</dd>
              </div>
            )}
          </dl>
        </Panel>

        <Panel title="Documentos">
          <div className="flex flex-col gap-2">
            {nf.danfeUrl ? (
              <a
                href={nf.danfeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
              >
                <ExternalLink className="size-4" />
                Abrir DANFE (PDF)
              </a>
            ) : (
              <p className="text-sm text-muted-foreground">DANFE indisponível</p>
            )}
            {nf.xmlUrl ? (
              <Button
                variant="link"
                className="h-auto justify-start p-0 text-sm"
                onClick={() =>
                  xmlDownload.mutate(nf.emissionId, {
                    onSuccess: ({ url }) => {
                      if (url) window.open(url, '_blank')
                    },
                  })
                }
              >
                <Download className="mr-2 size-4" />
                Baixar XML (signed URL)
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground">XML indisponível</p>
            )}
          </div>
        </Panel>
      </div>

      {nf.lastError && (
        <Panel title="Último erro SEFAZ">
          <p className="font-mono text-sm text-destructive">{nf.lastError}</p>
        </Panel>
      )}

      <Panel title="Ações">
        <div className="flex flex-wrap gap-3">
          {canRetry && (
            <Button
              variant="outline"
              disabled={retryNfe.isPending}
              onClick={() => retryNfe.mutate(nf.emissionId)}
            >
              <RefreshCw className={`mr-2 size-4 ${retryNfe.isPending ? 'animate-spin' : ''}`} />
              Reemitir NF
            </Button>
          )}
        </div>

        {nf.canCancel && (
          <div className="mt-6 space-y-3 border-t border-border pt-4">
            <p className="text-sm font-medium">Cancelar NF (prazo 24h)</p>
            <Textarea
              placeholder="Justificativa com mínimo de 15 caracteres"
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              rows={3}
            />
            <Button
              variant="destructive"
              size="sm"
              disabled={cancelNfe.isPending || justificativa.trim().length < 15}
              onClick={() =>
                cancelNfe.mutate({ emissionId: nf.emissionId, justificativa: justificativa.trim() })
              }
            >
              <XCircle className="mr-2 size-4" />
              Cancelar NF-e
            </Button>
          </div>
        )}

        {nf.status === 'autorizada' && !nf.canCancel && (
          <p className="mt-4 text-xs text-muted-foreground">
            Prazo de cancelamento expirado. Para estornar a operação, emita NF de devolução via
            logística reversa.
          </p>
        )}

        {nf.status === 'autorizada' && nf.type === 'NF-e' && (
          <div className="mt-6 space-y-3 border-t border-border pt-4">
            <p className="text-sm font-medium">Carta de Correção (CC-e)</p>
            <Textarea
              placeholder="Texto da correção com mínimo de 15 caracteres"
              value={correcao}
              onChange={(e) => setCorrecao(e.target.value)}
              rows={3}
            />
            <Button
              variant="outline"
              size="sm"
              disabled={cartaCorrecao.isPending || correcao.trim().length < 15}
              onClick={() =>
                cartaCorrecao.mutate({ emissionId: nf.emissionId, correcao: correcao.trim() })
              }
            >
              <FileEdit className="mr-2 size-4" />
              Enviar CC-e
            </Button>
          </div>
        )}
      </Panel>

      {events.length > 0 && (
        <Panel title="Histórico fiscal">
          <div className="space-y-2 text-sm">
            {events.map((e) => (
              <div key={e.id} className="border-b border-border/50 pb-2">
                <div className="flex justify-between">
                  <span className="font-medium">{e.eventType}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(e.createdAt).toLocaleString('pt-BR')}
                  </span>
                </div>
                {e.description && (
                  <p className="mt-1 text-xs text-muted-foreground">{e.description}</p>
                )}
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  )
}
