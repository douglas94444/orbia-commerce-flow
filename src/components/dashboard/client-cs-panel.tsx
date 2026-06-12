import { useState } from "react";
import { CalendarClock, CheckCircle2, Circle, MessageSquare, Phone, Smile } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Panel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useClientActivities,
  useClientOnboardingTasks,
  useLogCsActivity,
  useRecordNps,
  useToggleOnboardingTask,
} from "@/modules/admin/hooks/use-admin";
import { cn } from "@/lib/utils";

const KIND_LABEL: Record<string, string> = {
  contact: "Contato",
  qbr: "QBR",
  nps: "NPS",
  onboarding_note: "Nota onboarding",
};

const CHANNEL_LABEL: Record<string, string> = {
  call: "Ligação",
  email: "E-mail",
  whatsapp: "WhatsApp",
  meeting: "Reunião",
};

interface ClientCsPanelProps {
  clientId: string;
}

export function ClientCsPanel({ clientId }: ClientCsPanelProps) {
  const { data: onboarding, isLoading: loadingTasks } = useClientOnboardingTasks(clientId);
  const { data: activities = [], isLoading: loadingActivities } = useClientActivities(clientId);
  const toggleTask = useToggleOnboardingTask(clientId);
  const logActivity = useLogCsActivity(clientId);
  const recordNps = useRecordNps(clientId);

  const [open, setOpen] = useState(false);
  const [npsOpen, setNpsOpen] = useState(false);
  const [qbrOpen, setQbrOpen] = useState(false);
  const [channel, setChannel] = useState<"call" | "email" | "whatsapp" | "meeting">("call");
  const [notes, setNotes] = useState("");
  const [npsScore, setNpsScore] = useState("8");
  const [npsNotes, setNpsNotes] = useState("");
  const [qbrNotes, setQbrNotes] = useState("");
  const [qbrScheduledAt, setQbrScheduledAt] = useState("");

  function handleLogContact() {
    logActivity.mutate(
      { kind: "contact", channel, notes: notes || undefined },
      {
        onSuccess: () => {
          setOpen(false);
          setNotes("");
        },
      },
    );
  }

  const week = onboarding?.onboardingWeek ?? 1;
  const tasks = onboarding?.tasks ?? [];

  return (
    <>
      <Panel
        title="Customer Success"
        subtitle={`Onboarding — semana ${week}/4`}
        action={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setOpen(true)}>
              <Phone className="size-3.5" />
              Contato
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setNpsOpen(true)}>
              <Smile className="size-3.5" />
              NPS
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setQbrOpen(true)}>
              <CalendarClock className="size-3.5" />
              QBR
            </Button>
          </div>
        }
      >
        {loadingTasks ? (
          <div className="h-24 animate-pulse rounded-lg bg-muted/40" />
        ) : (
          <div className="space-y-2">
            {tasks.map((task) => (
              <button
                key={task.id}
                type="button"
                disabled={toggleTask.isPending}
                onClick={() => toggleTask.mutate({ taskId: task.id, isDone: !task.is_done })}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg border border-border bg-muted/20 px-3 py-2.5 text-left transition-colors hover:bg-muted/40",
                  task.is_done && "opacity-70",
                )}
              >
                {task.is_done ? (
                  <CheckCircle2 className="size-4 shrink-0 text-primary" />
                ) : (
                  <Circle className="size-4 shrink-0 text-muted-foreground" />
                )}
                <span className="text-sm text-foreground">{task.title}</span>
              </button>
            ))}
            {tasks.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma tarefa para esta semana.</p>
            )}
          </div>
        )}

        <div className="mt-6 border-t border-border pt-4">
          <div className="mb-3 flex items-center gap-2">
            <MessageSquare className="size-4 text-muted-foreground" />
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Últimas atividades
            </p>
          </div>
          {loadingActivities ? (
            <div className="h-16 animate-pulse rounded-lg bg-muted/40" />
          ) : activities.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma atividade CS registrada.</p>
          ) : (
            <ul className="space-y-2">
              {activities.slice(0, 5).map((a) => (
                <li key={a.id} className="rounded-lg border border-border bg-card/60 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {KIND_LABEL[a.kind] ?? a.kind}
                      {a.kind === "nps" && a.score != null ? ` (${a.score})` : ""}
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {new Date(a.occurredAt).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                  {(a.channel || a.notes) && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {[a.channel ? CHANNEL_LABEL[a.channel] ?? a.channel : null, a.notes]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Panel>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar contato</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Canal</Label>
              <select
                className="flex h-9 w-full rounded-lg border border-input bg-muted/20 px-3 text-sm"
                value={channel}
                onChange={(e) => setChannel(e.target.value as typeof channel)}
              >
                <option value="call">Ligação</option>
                <option value="email">E-mail</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="meeting">Reunião</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Notas (opcional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Resumo do contato…"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleLogContact} disabled={logActivity.isPending}>
              {logActivity.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={npsOpen} onOpenChange={setNpsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar NPS</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nota (0–10)</Label>
              <Input
                type="number"
                min={0}
                max={10}
                value={npsScore}
                onChange={(e) => setNpsScore(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Comentário (opcional)</Label>
              <Textarea value={npsNotes} onChange={(e) => setNpsNotes(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNpsOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() =>
                recordNps.mutate(
                  { score: Number(npsScore), notes: npsNotes || undefined },
                  { onSuccess: () => setNpsOpen(false) },
                )
              }
              disabled={recordNps.isPending}
            >
              Salvar NPS
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={qbrOpen} onOpenChange={setQbrOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agendar / registrar QBR</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Data da reunião</Label>
            <Input
              type="datetime-local"
              value={qbrScheduledAt}
              onChange={(e) => setQbrScheduledAt(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Notas da reunião</Label>
            <Textarea
              value={qbrNotes}
              onChange={(e) => setQbrNotes(e.target.value)}
              placeholder="Objetivos, decisões, próximos passos…"
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQbrOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                const scheduledAt = qbrScheduledAt
                  ? new Date(qbrScheduledAt).toISOString()
                  : undefined;
                logActivity.mutate(
                  {
                    kind: "qbr",
                    channel: "meeting",
                    notes: qbrNotes || undefined,
                    scheduledAt,
                  },
                  {
                    onSuccess: () => {
                      setQbrOpen(false);
                      setQbrScheduledAt("");
                      setQbrNotes("");
                    },
                  },
                );
              }}
              disabled={logActivity.isPending}
            >
              {qbrScheduledAt ? "Agendar QBR" : "Registrar QBR"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
