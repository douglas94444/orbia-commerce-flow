import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Handshake, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRegisterPartner } from "@/modules/sales/hooks/use-sales";

export const Route = createFileRoute("/parceiros/cadastro")({
  head: () => ({ meta: [{ title: "Programa de Parceiros — Orbia" }] }),
  component: ParceirosCadastroPage,
});

function ParceirosCadastroPage() {
  const register = useRegisterPartner();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await register.mutateAsync({ name, email });
    setCode(res.referralCode);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-6 py-4">
        <Link to="/" className="font-bold">Orbia</Link>
      </header>
      <div className="mx-auto max-w-lg px-6 py-16 text-center">
        <Handshake className="h-12 w-12 text-primary mx-auto" />
        <h1 className="font-display text-3xl font-bold mt-4">Programa de Parceiros</h1>
        <p className="text-muted-foreground mt-2">
          Gestores de tráfego, consultores e agências — indique lojistas e ganhe comissão recorrente.
        </p>

        {code ? (
          <div className="mt-8 rounded-xl border border-primary/30 bg-primary/5 p-6">
            <p className="text-sm text-muted-foreground">Seu link de indicação:</p>
            <p className="font-mono text-xl text-primary mt-2">{code}</p>
            <p className="text-sm mt-4">
              Compartilhe: <span className="text-foreground">/diagnostico?ref={code}</span>
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 space-y-4 text-left">
            <input required className="w-full rounded-lg border border-border bg-card px-4 py-3 text-sm" placeholder="Seu nome" value={name} onChange={(e) => setName(e.target.value)} />
            <input required type="email" className="w-full rounded-lg border border-border bg-card px-4 py-3 text-sm" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Button type="submit" className="w-full gap-2" disabled={register.isPending}>
              {register.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Cadastrar <ArrowRight className="h-4 w-4" /></>}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
