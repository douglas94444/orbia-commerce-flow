import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Loader2, Send, Sparkles } from "lucide-react";
import { PageIntro, Panel } from "@/components/dashboard/panel";
import { RFMBadge } from "@/shared/components";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  useSacTicket,
  useAssignSacTicket,
  useReplySacMessage,
  useChangeSacStatus,
  useSuggestSacReply,
  useSacQuickReplies,
} from "@/modules/sac/hooks/use-sac";

export const Route = createFileRoute("/_dashboard/sac/$ticketId")({
  head: () => ({ meta: [{ title: "Ticket SAC — Orbia" }] }),
  component: SacTicketPage,
});

function SacTicketPage() {
  const { ticketId } = Route.useParams();
  const { data: ticket, isLoading } = useSacTicket(ticketId);
  const { data: quickReplies = [] } = useSacQuickReplies();
  const { mutate: assign, isPending: assigning } = useAssignSacTicket();
  const { mutate: reply, isPending: sending } = useReplySacMessage();
  const { mutate: changeStatus } = useChangeSacStatus();
  const { mutate: suggest, isPending: suggesting } = useSuggestSacReply();

  const [body, setBody] = useState("");

  if (isLoading || !ticket) {
    return <p className="text-muted-foreground">Carregando ticket...</p>;
  }

  const handleSend = () => {
    if (!body.trim() || !ticket.conversationId) return;
    reply(
      { ticketId, conversationId: ticket.conversationId, body },
      { onSuccess: () => setBody("") },
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/sac">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <PageIntro
          eyebrow="Ticket"
          title={ticket.protocol}
          description={`${ticket.channel} · ${ticket.category} · ${ticket.status}`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <Panel className="flex flex-col" style={{ minHeight: 400 }}>
            <div className="flex-1 space-y-3 overflow-y-auto max-h-[480px] pr-2">
              {ticket.messages.map((m) => (
                <div
                  key={m.id}
                  className={cn(
                    "rounded-lg px-3 py-2 text-sm max-w-[85%]",
                    m.direction === "inbound"
                      ? "bg-muted/50 self-start"
                      : m.senderType === "bot"
                        ? "bg-violet-500/10 self-start"
                        : "bg-primary/10 ml-auto",
                  )}
                >
                  <p className="text-[10px] text-muted-foreground mb-1">
                    {m.senderType}{m.staffName ? ` · ${m.staffName}` : ""}
                  </p>
                  <p className="whitespace-pre-wrap">{m.body}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 space-y-2 border-t border-border/50 pt-4">
              {quickReplies.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {quickReplies.slice(0, 5).map((qr) => (
                    <button
                      key={qr.id}
                      type="button"
                      className="rounded-full border border-border px-2 py-0.5 text-xs hover:bg-muted"
                      onClick={() => setBody(qr.body)}
                    >
                      {qr.title}
                    </button>
                  ))}
                </div>
              )}
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Digite sua resposta..."
                rows={3}
              />
              <div className="flex gap-2">
                <Button onClick={handleSend} disabled={sending || !body.trim()}>
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Enviar
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    suggest(ticketId, {
                      onSuccess: (r) => setBody(r.suggestion),
                    })
                  }
                  disabled={suggesting}
                >
                  <Sparkles className="h-4 w-4" />
                  Sugerir IA
                </Button>
              </div>
            </div>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel>
            <h3 className="font-display text-sm font-semibold mb-3">Ações</h3>
            <div className="space-y-2">
              <Button
                className="w-full"
                variant="outline"
                onClick={() => assign(ticketId)}
                disabled={assigning}
              >
                Assumir ticket
              </Button>
              <select
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                value={ticket.status}
                onChange={(e) =>
                  changeStatus({
                    ticketId,
                    status: e.target.value as "open" | "in_progress" | "waiting_customer" | "resolved" | "closed",
                  })
                }
              >
                <option value="open">Aberto</option>
                <option value="in_progress">Em atendimento</option>
                <option value="waiting_customer">Aguardando cliente</option>
                <option value="resolved">Resolvido</option>
                <option value="closed">Fechado</option>
              </select>
            </div>
          </Panel>

          {ticket.customerContext && (
            <Panel>
              <h3 className="font-display text-sm font-semibold mb-3">Cliente</h3>
              <div className="space-y-3">
                {ticket.customerPhone && (
                  <p className="text-sm">{ticket.customerPhone}</p>
                )}
                {ticket.customerContext.rfmSegment && (
                  <RFMBadge segment={ticket.customerContext.rfmSegment} />
                )}
                <p className="font-mono text-lg font-semibold">
                  {formatBRL(ticket.customerContext.ltvCents / 100)}
                  <span className="ml-2 text-xs font-sans font-normal text-muted-foreground">LTV</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {ticket.customerContext.orderCount} pedidos · {ticket.customerContext.priorTickets} tickets anteriores
                </p>
                {ticket.customerContext.recentOrders.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium">Pedidos recentes</p>
                    {ticket.customerContext.recentOrders.map((o) => (
                      <div key={o.id} className="flex justify-between text-xs text-muted-foreground">
                        <span className="font-mono">{o.id.slice(0, 8)}</span>
                        <span>{o.status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Panel>
          )}

          {ticket.slaResponseDueAt && (
            <Panel>
              <h3 className="font-display text-sm font-semibold mb-2">SLA</h3>
              <p className="text-xs text-muted-foreground">
                1ª resposta até {new Date(ticket.slaResponseDueAt).toLocaleString("pt-BR")}
              </p>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
