import { Link } from "@tanstack/react-router";
import { ArrowRight, Loader2 } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSubmitDiagnostic } from "@/modules/sales/hooks/use-sales";

const SEGMENTS: Record<string, { title: string; subtitle: string; pain: string }> = {
  moda: {
    title: "Diagnóstico gratuito para lojas de moda",
    subtitle: "Coleções sazonais, alta devolução e ROAS instável? Veja onde sua operação perde dinheiro.",
    pain: "Coleção nova sem tráfego escalável e logística lenta no pico",
  },
  beleza: {
    title: "Diagnóstico gratuito para beleza & cosméticos",
    subtitle: "Recorrência, assinatura e influenciadores exigem retenção forte — descubra seus gaps.",
    pain: "Baixa recompra e dependência de lançamentos pontuais",
  },
  suplementos: {
    title: "Diagnóstico gratuito para suplementos",
    subtitle: "Compliance, assinatura e CAC alto? Análise focada no seu nicho.",
    pain: "CAC elevado e pouca recorrência pós-primeira compra",
  },
  default: {
    title: "Diagnóstico gratuito do seu e-commerce",
    subtitle: "Responda em 2 minutos e receba uma análise com score de saúde e lacunas críticas.",
    pain: "",
  },
};

interface DiagnosticFormProps {
  segment?: string;
  referralCode?: string;
}

export function DiagnosticForm({ segment = "default", referralCode }: DiagnosticFormProps) {
  const meta = SEGMENTS[segment] ?? SEGMENTS.default;
  const navigate = useNavigate();
  const submit = useSubmitDiagnostic();

  const [form, setForm] = useState({
    companyName: "",
    contactName: "",
    email: "",
    phone: "",
    platform: "Shopify",
    monthlyRevenue: "",
    adSpend: "",
    mainPain: meta.pain,
    isDecisionMaker: false,
    urgency: "30d" as const,
    fulfillmentType: "third_party" as const,
    hasEmailAutomation: false,
    hasWhatsappAutomation: false,
  });

  const parseBrl = (v: string) => Math.round(parseFloat(v.replace(/\D/g, "")) || 0) * 100;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await submit.mutateAsync({
      companyName: form.companyName,
      contactName: form.contactName,
      email: form.email,
      phone: form.phone || undefined,
      platform: form.platform,
      monthlyRevenueCents: parseBrl(form.monthlyRevenue) || 100_000_00,
      adSpendCents: parseBrl(form.adSpend),
      mainPain: form.mainPain,
      segment: segment === "default" ? "Geral" : segment.charAt(0).toUpperCase() + segment.slice(1),
      isDecisionMaker: form.isDecisionMaker,
      urgency: form.urgency,
      fulfillmentType: form.fulfillmentType,
      hasEmailAutomation: form.hasEmailAutomation,
      hasWhatsappAutomation: form.hasWhatsappAutomation,
      referralCode,
      source: referralCode ? "partner" : "inbound",
    });
    navigate({ to: "/diagnostico/resultado/$token", params: { token: res.publicToken } });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-lg bg-primary-gradient text-sm font-bold text-primary-foreground">O</span>
          <span className="font-bold">Orbia</span>
        </Link>
      </header>

      <div className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="font-display text-3xl font-bold">{meta.title}</h1>
        <p className="mt-3 text-muted-foreground">{meta.subtitle}</p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <input required className="rounded-lg border border-border bg-card px-4 py-3 text-sm" placeholder="Nome da empresa" value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} />
            <input required className="rounded-lg border border-border bg-card px-4 py-3 text-sm" placeholder="Seu nome" value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} />
          </div>
          <input required type="email" className="w-full rounded-lg border border-border bg-card px-4 py-3 text-sm" placeholder="E-mail" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <select className="w-full rounded-lg border border-border bg-card px-4 py-3 text-sm" value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })}>
            {["Shopify", "Nuvemshop", "Mercado Livre", "Shopee", "VTEX", "Outra"].map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <div className="grid gap-4 sm:grid-cols-2">
            <input className="rounded-lg border border-border bg-card px-4 py-3 text-sm" placeholder="Faturamento mensal (R$)" value={form.monthlyRevenue} onChange={(e) => setForm({ ...form, monthlyRevenue: e.target.value })} />
            <input className="rounded-lg border border-border bg-card px-4 py-3 text-sm" placeholder="Investimento em tráfego (R$)" value={form.adSpend} onChange={(e) => setForm({ ...form, adSpend: e.target.value })} />
          </div>
          <textarea className="w-full rounded-lg border border-border bg-card px-4 py-3 text-sm min-h-[80px]" placeholder="Principal dor operacional" value={form.mainPain} onChange={(e) => setForm({ ...form, mainPain: e.target.value })} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.isDecisionMaker} onChange={(e) => setForm({ ...form, isDecisionMaker: e.target.checked })} />
            Sou o decisor da operação
          </label>
          <Button type="submit" className="w-full gap-2" disabled={submit.isPending}>
            {submit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Ver meu diagnóstico <ArrowRight className="h-4 w-4" /></>}
          </Button>
        </form>
      </div>
    </div>
  );
}

export { SEGMENTS };
