import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  FileText,
  Loader2,
  MessageSquare,
  Phone,
  Plus,
} from "lucide-react";
import { PageIntro, Panel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/format";
import {
  useAddInteraction,
  useAssignProspect,
  useCompleteTask,
  useCreateContract,
  useCreateProposal,
  useCreateTask,
  useEnrollColdNurture,
  useMoveProspectStage,
  usePipelineStages,
  useProspect,
  useProspectMetaDiagnostics,
  useSalesStaff,
} from "@/modules/sales/hooks/use-sales";

export const Route = createFileRoute("/_dashboard/sales/$prospectId")({
  head: () => ({ meta: [{ title: "Prospect — Orbia Vendas" }] }),
  component: ProspectDetailPage,
});

function ProspectDetailPage() {
  const { prospectId } = Route.useParams();
  const { data, isLoading } = useProspect(prospectId);
  const { data: stages = [] } = usePipelineStages();
  const { data: staff = [] } = useSalesStaff();
  const { data: metaDiag } = useProspectMetaDiagnostics(prospectId);

  const moveStage = useMoveProspectStage();
  const assign = useAssignProspect();
  const addInteraction = useAddInteraction();
  const createTask = useCreateTask();
  const completeTask = useCompleteTask();
  const createProposal = useCreateProposal();
  const createContract = useCreateContract();
  const coldNurture = useEnrollColdNurture();

  const [note, setNote] = useState("");
  const [taskTitle, setTaskTitle] = useState("");

  if (isLoading || !data) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const { prospect, interactions, tasks } = data;

  return (
    <div className="space-y-6">
      <Link to="/sales" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Voltar ao pipeline
      </Link>

      <PageIntro
        eyebrow={prospect.stageLabel}
        title={prospect.companyName}
        description={`${prospect.contactName} · ${prospect.email} · ${prospect.segment}`}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2 space-y-4">
          <h3 className="font-display text-lg">Qualificação BANT</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Budget", value: prospect.bantBudget },
              { label: "Authority", value: prospect.bantAuthority },
              { label: "Need", value: prospect.bantNeed },
              { label: "Timeline", value: prospect.bantTimeline },
            ].map((b) => (
              <div key={b.label} className="rounded-lg bg-muted/30 p-3 text-center">
                <p className="text-xs text-muted-foreground">{b.label}</p>
                <p className="font-mono text-xl">{b.value}/25</p>
              </div>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            Score total: <span className="font-mono text-foreground">{prospect.qualificationScore}/100</span>
            {" · "}Faturamento: <span className="font-mono">{formatBRL(prospect.monthlyRevenueCents / 100)}</span>
            {" · "}Ads: <span className="font-mono">{formatBRL(prospect.adSpendCents / 100)}</span>
          </p>
          {prospect.mainPain && (
            <p className="text-sm"><strong>Dor principal:</strong> {prospect.mainPain}</p>
          )}

          <div className="flex flex-wrap gap-2 pt-2">
            <Button size="sm" onClick={() => createProposal.mutate({ prospectId })} disabled={createProposal.isPending}>
              <FileText className="h-4 w-4 mr-1" /> Gerar proposta
            </Button>
            <Button size="sm" variant="outline" onClick={() => createContract.mutate({ prospectId })} disabled={createContract.isPending}>
              Criar contrato
            </Button>
            <Button size="sm" variant="ghost" onClick={() => coldNurture.mutate(prospectId)}>
              Nutrição longa
            </Button>
          </div>

          {metaDiag && (
            <div className="rounded-lg border border-border/60 p-4 mt-4">
              <h4 className="text-sm font-medium mb-2">Diagnóstico Meta Ads — {metaDiag.overallScore}/100</h4>
              <p className="text-xs text-muted-foreground">{metaDiag.narrative}</p>
            </div>
          )}
        </Panel>

        <Panel className="space-y-4">
          <h3 className="font-display text-lg">Ações</h3>
          <select
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            value={prospect.stageId}
            onChange={(e) => {
              const stage = stages.find((s) => s.id === e.target.value);
              if (stage) moveStage.mutate({ prospectId, stageKey: stage.stageKey });
            }}
          >
            {stages.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
          <select
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            value={prospect.assignedStaffId ?? ""}
            onChange={(e) => assign.mutate({ prospectId, staffId: e.target.value })}
          >
            <option value="">Sem responsável</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => addInteraction.mutate({ prospectId, kind: "call", channel: "phone" })}>
              <Phone className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" onClick={() => addInteraction.mutate({ prospectId, kind: "email", channel: "email" })}>
              <MessageSquare className="h-4 w-4" />
            </Button>
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <h3 className="font-display text-lg mb-4">Histórico</h3>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {interactions.map((i) => (
              <div key={i.id} className="border-b border-border/40 pb-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{i.kind} · {i.staffName ?? "sistema"}</span>
                  <span>{new Date(i.occurredAt).toLocaleDateString("pt-BR")}</span>
                </div>
                {i.notes && <p className="text-sm mt-1">{i.notes}</p>}
              </div>
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <input
              className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
              placeholder="Registrar nota ou objeção..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <Button
              size="sm"
              onClick={() => {
                if (!note.trim()) return;
                addInteraction.mutate({ prospectId, kind: "note", notes: note });
                setNote("");
              }}
            >
              Salvar
            </Button>
          </div>
        </Panel>

        <Panel>
          <h3 className="font-display text-lg mb-4">Tarefas</h3>
          <div className="space-y-2">
            {tasks.map((t) => (
              <div key={t.id} className="flex items-center gap-2 text-sm">
                <button
                  type="button"
                  onClick={() => !t.completedAt && completeTask.mutate(t.id)}
                  className={t.completedAt ? "text-green-400" : "text-muted-foreground hover:text-primary"}
                >
                  <CheckCircle2 className="h-4 w-4" />
                </button>
                <span className={t.completedAt ? "line-through text-muted-foreground" : ""}>{t.title}</span>
                <span className="ml-auto text-xs text-muted-foreground font-mono">
                  {new Date(t.dueAt).toLocaleDateString("pt-BR")}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <input
              className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
              placeholder="Nova tarefa de follow-up..."
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
            />
            <Button
              size="sm"
              onClick={() => {
                if (!taskTitle.trim()) return;
                const due = new Date(Date.now() + 2 * 86400000).toISOString();
                createTask.mutate({ prospectId, title: taskTitle, dueAt: due });
                setTaskTitle("");
              }}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </Panel>
      </div>
    </div>
  );
}