import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Search } from "lucide-react";
import { PageIntro, Panel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { submitSupportForm, lookupSupportProtocol } from "@/modules/sac/public.functions";

export const Route = createFileRoute("/portal/support")({
  head: () => ({ meta: [{ title: "Suporte — Orbia" }] }),
  component: PortalSupportPage,
});

function PortalSupportPage() {
  const [mode, setMode] = useState<"form" | "lookup">("form");
  const [loading, setLoading] = useState(false);
  const [protocol, setProtocol] = useState<string | null>(null);
  const [lookupResult, setLookupResult] = useState<{
    protocol: string;
    status: string;
    category: string;
    createdAt: string;
    resolvedAt: string | null;
  } | null>(null);

  const [form, setForm] = useState({
    clientSlug: "",
    name: "",
    email: "",
    phone: "",
    subject: "",
    message: "",
    orderRef: "",
  });

  const [lookup, setLookup] = useState({ protocol: "", email: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await submitSupportForm({ data: form });
      setProtocol(result.protocol);
      toast.success(`Protocolo gerado: ${result.protocol}`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await lookupSupportProtocol({ data: lookup });
      setLookupResult(result);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg space-y-6 p-6">
      <PageIntro
        eyebrow="Suporte"
        title="Central de Suporte"
        description="Abra um chamado ou consulte o status pelo protocolo."
      />

      <div className="flex gap-2">
        <Button variant={mode === "form" ? "default" : "outline"} onClick={() => setMode("form")}>
          Novo chamado
        </Button>
        <Button variant={mode === "lookup" ? "default" : "outline"} onClick={() => setMode("lookup")}>
          <Search className="h-4 w-4" /> Consultar protocolo
        </Button>
      </div>

      {mode === "form" ? (
        <Panel>
          {protocol ? (
            <div className="text-center py-6">
              <p className="text-sm text-muted-foreground mb-2">Seu protocolo:</p>
              <p className="font-mono text-2xl font-bold text-primary">{protocol}</p>
              <p className="text-xs text-muted-foreground mt-4">Guarde este número para acompanhar seu chamado.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Loja (slug ou nome)</Label>
                <Input required value={form.clientSlug} onChange={(e) => setForm({ ...form, clientSlug: e.target.value })} />
              </div>
              <div>
                <Label>Nome</Label>
                <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <Label>Email</Label>
                <Input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <Label>Telefone (opcional)</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div>
                <Label>Assunto</Label>
                <Input required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
              </div>
              <div>
                <Label>Nº do pedido (opcional)</Label>
                <Input value={form.orderRef} onChange={(e) => setForm({ ...form, orderRef: e.target.value })} />
              </div>
              <div>
                <Label>Mensagem</Label>
                <Textarea required rows={5} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
              </div>
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "Enviando..." : "Enviar chamado"}
              </Button>
            </form>
          )}
        </Panel>
      ) : (
        <Panel>
          <form onSubmit={handleLookup} className="space-y-4">
            <div>
              <Label>Protocolo</Label>
              <Input required placeholder="ORB-2026-XXXXXX" value={lookup.protocol} onChange={(e) => setLookup({ ...lookup, protocol: e.target.value })} />
            </div>
            <div>
              <Label>Email usado no chamado</Label>
              <Input type="email" required value={lookup.email} onChange={(e) => setLookup({ ...lookup, email: e.target.value })} />
            </div>
            <Button type="submit" disabled={loading} className="w-full">Consultar</Button>
          </form>
          {lookupResult && (
            <div className="mt-4 rounded-lg border border-border p-4 text-sm space-y-1">
              <p><strong>Protocolo:</strong> <span className="font-mono">{lookupResult.protocol}</span></p>
              <p><strong>Status:</strong> {lookupResult.status}</p>
              <p><strong>Categoria:</strong> {lookupResult.category}</p>
              <p><strong>Aberto em:</strong> {new Date(lookupResult.createdAt).toLocaleString("pt-BR")}</p>
              {lookupResult.resolvedAt && (
                <p><strong>Resolvido em:</strong> {new Date(lookupResult.resolvedAt).toLocaleString("pt-BR")}</p>
              )}
            </div>
          )}
        </Panel>
      )}
    </div>
  );
}
