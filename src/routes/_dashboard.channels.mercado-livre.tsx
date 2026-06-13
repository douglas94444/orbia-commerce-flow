import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { AlertTriangle, MessageCircle, Shield, Star } from 'lucide-react'
import { PageIntro, Panel } from '@/components/dashboard/panel'
import { KpiCard } from '@/components/dashboard/kpi-card'
import { StatusPill } from '@/components/dashboard/status-pill'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import {
  useMlQuestions,
  useMlReputation,
  useMlComplaints,
  useSuggestMlAnswer,
  useIntegrationHealth,
} from '@/modules/marketplaces/hooks/use-marketplaces'
import {
  ChannelSubNav,
  ChannelOAuthBanner,
} from '@/modules/marketplaces/components/channel-sub-nav'

export const Route = createFileRoute('/_dashboard/channels/mercado-livre')({
  head: () => ({ meta: [{ title: 'Mercado Livre — Canais' }] }),
  component: MercadoLivrePage,
})

function MercadoLivrePage() {
  const { data: health = [] } = useIntegrationHealth()
  const { data: reputation, isLoading: loadingRep } = useMlReputation()
  const { data: questions = [], isLoading: loadingQuestions } = useMlQuestions()
  const { data: complaints = [], isLoading: loadingComplaints } = useMlComplaints()
  const suggestAnswer = useSuggestMlAnswer()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [suggestedAnswer, setSuggestedAnswer] = useState('')
  const [activeQuestion, setActiveQuestion] = useState<{
    text: string
    itemTitle: string
  } | null>(null)

  const mlHealth = health.find((h) => h.provider === 'mercado_livre')
  const isDisconnected = !mlHealth || mlHealth.status === 'down'

  const handleSuggest = (questionText: string, itemTitle: string) => {
    setActiveQuestion({ text: questionText, itemTitle })
    setSuggestedAnswer('')
    setDialogOpen(true)
    suggestAnswer.mutate(
      { questionText, productTitle: itemTitle },
      {
        onSuccess: (res) => setSuggestedAnswer(res.answer),
      },
    )
  }

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Mercado Livre"
        title="Reputação, Q&A e reclamações"
        description="Métricas de seller, perguntas abertas com sugestão IA e alertas de claims."
      />
      <ChannelSubNav />

      {isDisconnected && <ChannelOAuthBanner provider="mercado_livre" label="Mercado Livre" />}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Nível reputação"
          value={loadingRep ? '—' : (reputation?.levelId ?? 'N/A')}
          icon={Star}
          accent="primary"
        />
        <KpiCard
          label="Power Seller"
          value={loadingRep ? '—' : (reputation?.powerSellerStatus ?? '—')}
          icon={Shield}
          accent="success"
        />
        <KpiCard
          label="Transações"
          value={
            loadingRep
              ? '—'
              : String(reputation?.transactions.total ?? 0)
          }
          hint={
            reputation
              ? `${reputation.transactions.completed} concluídas · ${reputation.transactions.canceled} canceladas`
              : undefined
          }
          icon={MessageCircle}
        />
        <KpiCard
          label="Claims"
          value={loadingRep ? '—' : String(reputation?.metrics.claims ?? 0)}
          hint={
            reputation
              ? `${reputation.metrics.delayedHandling} atrasos · ${reputation.metrics.cancellations} cancel.`
              : undefined
          }
          icon={AlertTriangle}
          accent="warning"
        />
      </div>

      <Panel title="Perguntas abertas" subtitle="Status UNANSWERED — resposta via API ML fora de escopo">
        {loadingQuestions ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : questions.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma pergunta pendente.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-2 pr-4">Item</th>
                  <th className="py-2 pr-4">Pergunta</th>
                  <th className="py-2 pr-4">Data</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {questions.map((q) => (
                  <tr key={q.id} className="border-b border-border/50">
                    <td className="py-2 pr-4 max-w-[160px] truncate">{q.itemTitle}</td>
                    <td className="py-2 pr-4">{q.text}</td>
                    <td className="py-2 pr-4 font-mono text-xs">
                      {new Date(q.dateCreated).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="py-2 pr-4">
                      <StatusPill label={q.status} tone="warning" />
                    </td>
                    <td className="py-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={suggestAnswer.isPending}
                        onClick={() => handleSuggest(q.text, q.itemTitle)}
                      >
                        Sugerir resposta IA
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Reclamações" subtitle="Claims abertos no Mercado Livre">
        {loadingComplaints ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : complaints.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma reclamação ativa.</p>
        ) : (
          <div className="space-y-3">
            {complaints.map((c) => (
              <div
                key={c.claimId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium">{c.resource}</p>
                  <p className="text-xs text-muted-foreground">{c.reason}</p>
                </div>
                <StatusPill label={c.status} tone="danger" dot />
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Sugestão de resposta (IA)</DialogTitle>
          </DialogHeader>
          {activeQuestion && (
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{activeQuestion.itemTitle}</span>
              <br />
              {activeQuestion.text}
            </p>
          )}
          <Textarea
            readOnly
            value={suggestAnswer.isPending ? 'Gerando sugestão…' : suggestedAnswer}
            rows={6}
            className="font-sans text-sm"
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
