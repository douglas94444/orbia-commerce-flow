import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageIntro, Panel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Calendar, Truck } from "lucide-react";
import {
  useCarrierPickups,
  useScheduleCarrierPickup,
  useCarrierConfigs,
} from "@/modules/logistics/hooks/use-fulfillly";

export const Route = createFileRoute("/_dashboard/logistics/pickups")({
  head: () => ({ meta: [{ title: "Coletas — Fulfillly" }] }),
  component: PickupsPage,
});

function PickupsPage() {
  const { data: pickups = [], isLoading } = useCarrierPickups();
  const { data: carrierData } = useCarrierConfigs();
  const schedule = useScheduleCarrierPickup();

  const [provider, setProvider] = useState("melhor_envio");
  const [scheduledAt, setScheduledAt] = useState("");
  const [notes, setNotes] = useState("");

  const providers = carrierData?.providers ?? [{ id: "melhor_envio", name: "Melhor Envio" }];

  const handleSchedule = () => {
    if (!scheduledAt) return;
    schedule.mutate({ provider, scheduledAt: new Date(scheduledAt).toISOString(), notes: notes || undefined });
  };

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Fulfillly"
        title="Coletas agendadas"
        description="Agende coleta com transportadora quando houver volume de pedidos despachados."
        action={<Truck className="size-5 text-primary" />}
      />

      <Link to="/logistics/carriers">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="mr-2 size-4" />
          Voltar às transportadoras
        </Button>
      </Link>

      <Panel title="Agendar nova coleta">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Transportadora</label>
            <select
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
            >
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Data/hora</label>
            <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Observações</label>
            <Input placeholder="Opcional" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <Button className="mt-4 gap-2" onClick={handleSchedule} disabled={!scheduledAt || schedule.isPending}>
          <Calendar className="size-4" />
          Agendar coleta
        </Button>
      </Panel>

      <Panel title="Histórico de coletas">
        {isLoading ? (
          <div className="h-24 animate-pulse rounded-xl bg-muted/40" />
        ) : pickups.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma coleta agendada.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                  <th className="pb-2">Transportadora</th>
                  <th className="pb-2">Agendado</th>
                  <th className="pb-2">Pedidos</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {pickups.map((p) => (
                  <tr key={p.id} className="border-b border-border/50">
                    <td className="py-2 font-mono text-xs">{p.provider}</td>
                    <td className="py-2">{new Date(p.scheduledAt).toLocaleString("pt-BR")}</td>
                    <td className="py-2 font-mono">{p.orderCount}</td>
                    <td className="py-2 capitalize">{p.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
