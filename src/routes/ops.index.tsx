import { createFileRoute } from "@tanstack/react-router";
import { useOpsTasks, useGeneratePickWave } from "@/modules/logistics/hooks/use-fulfillly";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/ops/")({
  component: OpsHomePage,
});

function OpsHomePage() {
  const { data, isLoading } = useOpsTasks();
  const generateWave = useGeneratePickWave();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-semibold">Fila do dia</h1>
        <p className="text-sm text-muted-foreground">Tarefas priorizadas por SLA</p>
      </div>

      <Button
        className="w-full"
        onClick={() => generateWave.mutate()}
        disabled={generateWave.isPending}
      >
        {generateWave.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
        Gerar onda de picking
      </Button>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <section className="space-y-2">
            <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Picking ({data?.pickTasks?.length ?? 0})
            </h2>
            {(data?.pickTasks ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma tarefa de picking</p>
            ) : (
              (data?.pickTasks ?? []).map((t: { id: string; status: string }) => (
                <div
                  key={t.id}
                  className="rounded-xl border border-border bg-card p-3 text-sm"
                >
                  Tarefa {t.id.slice(0, 8)} — {t.status}
                </div>
              ))
            )}
          </section>

          <section className="space-y-2">
            <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Recebimentos ({data?.receivingAppointments?.length ?? 0})
            </h2>
            {(data?.receivingAppointments ?? []).map((a: { id: string; scheduled_at: string }) => (
              <div
                key={a.id}
                className="flex items-center gap-2 rounded-xl border border-border bg-card p-3 text-sm"
              >
                <AlertTriangle className="size-4 text-warning" />
                {new Date(a.scheduled_at).toLocaleString("pt-BR")}
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
