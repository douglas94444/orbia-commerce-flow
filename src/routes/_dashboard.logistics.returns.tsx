import { createFileRoute } from "@tanstack/react-router";
import { PageIntro, Panel } from "@/components/dashboard/panel";
import {
  useReturns,
  useApproveReturn,
  useMarkReturnReceived,
  useInspectReturn,
} from "@/modules/logistics/hooks/use-fulfillly";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/dashboard/status-pill";

export const Route = createFileRoute("/_dashboard/logistics/returns")({
  head: () => ({ meta: [{ title: "Devoluções — Fulfillly" }] }),
  component: ReturnsPage,
});

const STATUS_TONE: Record<string, "warning" | "primary" | "success" | "danger"> = {
  pending: "warning",
  approved: "primary",
  in_transit: "primary",
  received: "primary",
  completed: "success",
  rejected: "danger",
  cancelled: "danger",
};

function ReturnsPage() {
  const { data: returns = [], isLoading } = useReturns();
  const approve = useApproveReturn();
  const markReceived = useMarkReturnReceived();
  const inspect = useInspectReturn();

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Fulfillly"
        title="Logística reversa"
        description="Aprovação, etiqueta de devolução, inspeção, NF-e e reembolso automático."
      />

      <Panel title="Solicitações">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : returns.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma devolução</p>
        ) : (
          <div className="space-y-3">
            {returns.map((r) => (
              <div key={r.id} className="rounded-xl border border-border p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-mono text-xs">{r.id.slice(0, 8)}</span>
                  <StatusPill label={r.status} tone={STATUS_TONE[r.status] ?? "primary"} />
                </div>
                <p className="text-sm">{r.reason}</p>
                {r.tracking_code && (
                  <p className="mt-1 font-mono text-xs text-muted-foreground">
                    Rastreio: {r.tracking_code}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  {r.status === "pending" && (
                    <Button size="sm" onClick={() => approve.mutate(r.id)} disabled={approve.isPending}>
                      Aprovar
                    </Button>
                  )}
                  {r.status === "in_transit" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => markReceived.mutate(r.id)}
                    >
                      Marcar recebido
                    </Button>
                  )}
                  {r.status === "received" && (
                    <>
                      <Button
                        size="sm"
                        onClick={() =>
                          inspect.mutate({
                            returnRequestId: r.id,
                            destination: "reintegrate",
                          })
                        }
                      >
                        Reintegrar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          inspect.mutate({
                            returnRequestId: r.id,
                            destination: "quarantine",
                          })
                        }
                      >
                        Quarentena
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
