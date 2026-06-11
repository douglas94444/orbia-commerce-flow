import { createFileRoute, Link } from "@tanstack/react-router";
import { useOpsTasks, useGeneratePickWave } from "@/modules/logistics/hooks/use-fulfillly";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle, MapPin } from "lucide-react";

export const Route = createFileRoute("/ops/")({
  component: OpsHomePage,
});

function OpsHomePage() {
  const { data, isLoading } = useOpsTasks();
  const generateWave = useGeneratePickWave();
  const pickLines = data?.pickLines ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-semibold">Fila do dia</h1>
        <p className="text-sm text-muted-foreground">Linhas de pick ordenadas por SLA</p>
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
              Picking ({pickLines.length} linhas)
            </h2>
            {pickLines.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma linha pendente</p>
            ) : (
              pickLines.slice(0, 15).map((line) => (
                <Link
                  key={line.lineId}
                  to="/ops/picking"
                  search={{ lineId: line.lineId }}
                  className="block rounded-xl border border-border bg-card p-3 text-sm transition-colors hover:border-primary/40"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-mono font-medium">{line.sku}</p>
                      <p className="text-xs text-muted-foreground">
                        Pedido {line.orderExternalId} · qtd {line.qtyRequired}
                      </p>
                      {line.locationLabel && (
                        <p className="mt-1 flex items-center gap-1 text-xs text-primary">
                          <MapPin className="size-3" />
                          {line.locationLabel}
                        </p>
                      )}
                    </div>
                    {line.slaDeadlineAt && (
                      <span className="shrink-0 font-mono text-[10px] text-warning">
                        SLA {new Date(line.slaDeadlineAt).toLocaleString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    )}
                  </div>
                </Link>
              ))
            )}
            {pickLines.length > 15 && (
              <Link to="/ops/picking">
                <Button variant="outline" className="w-full" size="sm">
                  Ver todas ({pickLines.length})
                </Button>
              </Link>
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
