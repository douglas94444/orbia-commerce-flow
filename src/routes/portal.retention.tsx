import { createFileRoute } from '@tanstack/react-router'
import { Mail, MessageSquare, Smartphone } from 'lucide-react'
import { PageIntro, Panel } from '@/components/dashboard/panel'
import { StatusPill } from '@/components/dashboard/status-pill'
import { useAutomations, useToggleAutomation } from '@/modules/retention/hooks/use-retention'
import { useCurrentClient } from '@/modules/clients/hooks/use-current-client'

export const Route = createFileRoute('/portal/retention')({
  head: () => ({ meta: [{ title: 'Retenção — Portal Orbia' }] }),
  component: PortalRetentionPage,
})

const CHANNEL_ICON = { Email: Mail, SMS: Smartphone, WhatsApp: MessageSquare } as const

function PortalRetentionPage() {
  const { data: automations = [], isLoading } = useAutomations()
  const { data: currentClient } = useCurrentClient()
  const { mutate: toggle, isPending } = useToggleAutomation()

  const canToggle = currentClient && ['owner', 'admin'].includes(currentClient.memberRole)

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Pós-venda"
        title="Automações"
        description="Ative ou pause fluxos de retenção configurados pela Orbia."
      />

      <Panel title="Fluxos disponíveis">
        {isLoading ? (
          <div className="h-24 animate-pulse rounded-lg bg-muted/40" />
        ) : automations.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Nenhum fluxo configurado.</p>
        ) : (
          <div className="space-y-3">
            {automations.map((flow) => {
              const Icon = CHANNEL_ICON[flow.channel] ?? Mail
              return (
                <div
                  key={flow.id}
                  className="flex items-center justify-between rounded-xl border border-border bg-muted/20 px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <Icon className="size-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{flow.name}</p>
                      <p className="text-[11px] text-muted-foreground">{flow.trigger}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusPill
                      label={flow.active ? 'Ativo' : 'Pausado'}
                      tone={flow.active ? 'success' : 'neutral'}
                      dot
                    />
                    {canToggle && (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => toggle(flow.id)}
                        className="text-xs text-primary hover:underline disabled:opacity-50"
                      >
                        {flow.active ? 'Pausar' : 'Ativar'}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Panel>
    </div>
  )
}
