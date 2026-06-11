import { createFileRoute, Link } from "@tanstack/react-router";
import { PageIntro, Panel } from "@/components/dashboard/panel";
import {
  useCreateReceivingAppointment,
  useOpsTasks,
} from "@/modules/logistics/hooks/use-fulfillly";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Smartphone } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_dashboard/logistics/receiving")({
  head: () => ({ meta: [{ title: "Recebimento — Fulfillly" }] }),
  component: ReceivingPage,
});

function ReceivingPage() {
  const { data: ops } = useOpsTasks();
  const createAppt = useCreateReceivingAppointment();
  const [sku, setSku] = useState("");
  const [qty, setQty] = useState(1);
  const [items, setItems] = useState<Array<{ sku: string; qty: number }>>([]);
  const [scheduledAt, setScheduledAt] = useState("");

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Fulfillly WMS"
        title="Recebimento de mercadoria"
        description="Agende conferências e execute no app operador com scanner de código de barras."
      />
      <Panel
        title="Agendamentos"
        action={
          <Link to="/ops/receiving">
            <Button variant="outline" size="sm">
              <Smartphone className="mr-1 size-4" />
              Conferir no app
            </Button>
          </Link>
        }
      >
        {(ops?.receivingAppointments ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum recebimento agendado</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {(ops?.receivingAppointments ?? []).map((a: { id: string; scheduled_at: string }) => (
              <li key={a.id} className="rounded-lg border border-border px-3 py-2">
                {new Date(a.scheduled_at).toLocaleString("pt-BR")}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Novo agendamento">
        <div className="grid gap-3 sm:grid-cols-3">
          <Input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
          />
          <Input placeholder="SKU" value={sku} onChange={(e) => setSku(e.target.value)} />
          <Input
            type="number"
            placeholder="Qtd"
            value={qty}
            onChange={(e) => setQty(Number(e.target.value))}
          />
          <Button
            variant="outline"
            onClick={() => {
              if (!sku) return;
              setItems((prev) => [...prev, { sku, qty }]);
              setSku("");
            }}
          >
            Adicionar item
          </Button>
        </div>
        {items.length > 0 && (
          <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
            {items.map((i, idx) => (
              <li key={idx} className="font-mono">
                {i.sku} × {i.qty}
              </li>
            ))}
          </ul>
        )}
        <Button
          className="mt-4"
          disabled={!scheduledAt || items.length === 0 || createAppt.isPending}
          onClick={() =>
            createAppt.mutate({
              scheduledAt: new Date(scheduledAt).toISOString(),
              expectedItems: items,
            })
          }
        >
          Agendar recebimento
        </Button>
      </Panel>
    </div>
  );
}
