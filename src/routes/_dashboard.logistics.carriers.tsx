import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageIntro, Panel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useCarrierConfigs, useUpsertCarrierConfig } from "@/modules/logistics/hooks/use-fulfillly";
import { Truck, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_dashboard/logistics/carriers")({
  head: () => ({ meta: [{ title: "Transportadoras — Orbia" }] }),
  component: CarriersPage,
});

function CarriersPage() {
  const { data, isLoading } = useCarrierConfigs();
  const upsert = useUpsertCarrierConfig();
  const [provider, setProvider] = useState("melhor_envio");
  const [priority, setPriority] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [autoSelect, setAutoSelect] = useState(true);
  const [credentialsRef, setCredentialsRef] = useState("");

  const configs = data?.configs ?? [];
  const providers = data?.providers ?? [];

  const handleSave = () => {
    upsert.mutate({
      provider,
      isActive,
      priority,
      autoSelect,
      credentialsRef: credentialsRef || undefined,
    });
  };

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Fulfillly"
        title="Transportadoras"
        description="Prioridade e seleção automática por lojista. Correios, Jadlog e demais carriers são cotados via Melhor Envio (proxy) — configure ME como provedor principal."
        action={<Truck className="size-5 text-primary" />}
      />

      <Link to="/logistics">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="mr-2 size-4" />
          Voltar à logística
        </Button>
      </Link>

      <Panel title="Configurar transportadora">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Provedor</label>
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
            <label className="mb-1 block text-xs text-muted-foreground">Prioridade (menor = primeiro)</label>
            <Input
              type="number"
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Ref. credenciais (opcional)</label>
            <Input
              placeholder="oauth_connections / env ref"
              value={credentialsRef}
              onChange={(e) => setCredentialsRef(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-3 pt-2">
            <label className="flex items-center justify-between text-sm">
              Ativa
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </label>
            <label className="flex items-center justify-between text-sm">
              Seleção automática
              <Switch checked={autoSelect} onCheckedChange={setAutoSelect} />
            </label>
          </div>
        </div>
        <Button className="mt-4" onClick={handleSave} disabled={upsert.isPending}>
          Salvar configuração
        </Button>
      </Panel>

      <Panel title="Configurações ativas">
        {isLoading ? (
          <div className="h-24 animate-pulse rounded-xl bg-muted/40" />
        ) : configs.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma transportadora configurada — usa Melhor Envio por padrão.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                  <th className="pb-2 pr-4">Provedor</th>
                  <th className="pb-2 pr-4">Prioridade</th>
                  <th className="pb-2 pr-4">Ativa</th>
                  <th className="pb-2">Auto</th>
                </tr>
              </thead>
              <tbody>
                {configs.map((c) => (
                  <tr key={c.id} className="border-b border-border/50">
                    <td className="py-2 pr-4 font-mono text-xs">{c.provider}</td>
                    <td className="py-2 pr-4 font-mono">{c.priority}</td>
                    <td className="py-2 pr-4">{c.isActive ? "Sim" : "Não"}</td>
                    <td className="py-2">{c.autoSelect ? "Sim" : "Não"}</td>
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
