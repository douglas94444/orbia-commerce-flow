import { createFileRoute } from '@tanstack/react-router'
import { PageIntro, Panel } from '@/components/dashboard/panel'
import { StatusPill } from '@/components/dashboard/status-pill'
import { formatBRL } from '@/lib/format'
import { useCampaigns } from '@/modules/traffic/hooks/use-traffic'

export const Route = createFileRoute('/portal/traffic')({
  head: () => ({ meta: [{ title: 'Tráfego — Portal Orbia' }] }),
  component: PortalTrafficPage,
})

const CAMPAIGN_TONE = { ativa: 'success', atencao: 'warning', pausada: 'neutral' } as const
const CAMPAIGN_LABEL = { ativa: 'Ativa', atencao: 'Atenção', pausada: 'Pausada' } as const

function PortalTrafficPage() {
  const { data: campaigns = [], isLoading } = useCampaigns()

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Mídia paga"
        title="Campanhas"
        description="Performance das suas campanhas Meta e Google (somente leitura)."
      />

      <Panel title="Campanhas ativas">
        {isLoading ? (
          <div className="h-24 animate-pulse rounded-lg bg-muted/40" />
        ) : campaigns.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhuma campanha sincronizada. A equipe Orbia conecta suas contas de anúncio.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[10px] uppercase text-muted-foreground">
                  {['Campanha', 'Plataforma', 'Investido', 'ROAS', 'Status'].map((h) => (
                    <th key={h} className="pb-2">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {campaigns.map((c) => (
                  <tr key={c.id}>
                    <td className="py-2 font-medium">{c.name}</td>
                    <td className="py-2 text-muted-foreground">{c.platform}</td>
                    <td className="py-2 font-mono">{formatBRL(c.spend, true)}</td>
                    <td className="py-2 font-mono font-semibold">{c.roas.toFixed(1)}x</td>
                    <td className="py-2">
                      <StatusPill label={CAMPAIGN_LABEL[c.status]} tone={CAMPAIGN_TONE[c.status]} dot />
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
