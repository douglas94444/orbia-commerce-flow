import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { MessageSquare, Search } from "lucide-react";
import { PageIntro, Panel } from "@/components/dashboard/panel";
import { StatusPill } from "@/components/dashboard/status-pill";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSacInbox } from "@/modules/sac/hooks/use-sac";

export const Route = createFileRoute("/_dashboard/sac")({
  head: () => ({ meta: [{ title: "SAC — Orbia" }] }),
  component: SacInboxPage,
});

const PRIORITY_COLORS: Record<string, string> = {
  critical: "text-red-400",
  urgent: "text-orange-400",
  high: "text-amber-400",
  normal: "text-foreground",
  low: "text-muted-foreground",
};

const CHANNEL_LABEL: Record<string, string> = {
  whatsapp: "WhatsApp",
  email: "Email",
  mercado_livre: "Mercado Livre",
  shopee: "Shopee",
  amazon: "Amazon",
  instagram: "Instagram",
  site_form: "Site",
  chat: "Chat",
};

function SacInboxPage() {
  const [channel, setChannel] = useState("");
  const [status, setStatus] = useState("");
  const { data: tickets = [], isLoading } = useSacInbox();

  const filtered = tickets.filter((t) => {
    if (channel && t.channel !== channel) return false;
    if (status && t.status !== status) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Atendimento"
        title="SAC & Atendimento"
        description="Inbox unificada — WhatsApp, marketplaces, email e formulário do site."
      />

      <div className="flex flex-wrap gap-2">
        <Link to="/sac/metrics">
          <Button variant="outline" size="sm">Métricas</Button>
        </Link>
        <Link to="/sac/knowledge">
          <Button variant="outline" size="sm">Base de conhecimento</Button>
        </Link>
      </div>

      <Panel>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <select
              className="w-full rounded-lg border border-border bg-background pl-9 pr-3 py-2 text-sm"
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
            >
              <option value="">Todos os canais</option>
              {Object.entries(CHANNEL_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <select
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">Todos os status</option>
            <option value="open">Aberto</option>
            <option value="in_progress">Em atendimento</option>
            <option value="waiting_customer">Aguardando cliente</option>
            <option value="resolved">Resolvido</option>
          </select>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando fila...</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum ticket na fila.</p>
        ) : (
          <div className="divide-y divide-border/50">
            {filtered.map((t) => (
              <Link
                key={t.id}
                to="/sac/$ticketId"
                params={{ ticketId: t.id }}
                className="flex items-center gap-4 py-3 transition hover:bg-muted/30 -mx-2 px-2 rounded-lg"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <MessageSquare className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-medium">{t.protocol}</span>
                    <StatusPill
                      label={t.priority}
                      tone={t.priority === "critical" ? "danger" : t.priority === "high" ? "warning" : "neutral"}
                    />
                    {t.unreadCount > 0 && (
                      <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                        {t.unreadCount}
                      </span>
                    )}
                  </div>
                  <p className="truncate text-sm text-muted-foreground">
                    {CHANNEL_LABEL[t.channel] ?? t.channel} · {t.category}
                    {t.customerPhone ? ` · ${t.customerPhone}` : ""}
                  </p>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <p className={cn("font-medium capitalize", PRIORITY_COLORS[t.priority])}>{t.status}</p>
                  <p>{new Date(t.createdAt).toLocaleDateString("pt-BR")}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
