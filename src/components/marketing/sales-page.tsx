import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BarChart3,
  Check,
  FileText,
  Repeat,
  Shield,
  TrendingUp,
  Truck,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatBRL } from "@/lib/format";

const features = [
  {
    icon: TrendingUp,
    title: "Tráfego pago",
    description: "Campanhas Meta e Google com ROAS monitorado e diagnóstico contínuo pela equipe.",
  },
  {
    icon: Truck,
    title: "Logística omnichannel",
    description: "Pedidos de Shopify, Nuvemshop, Mercado Livre e Shopee em um painel só.",
  },
  {
    icon: Repeat,
    title: "Retenção & LTV",
    description: "Automações pós-venda, WhatsApp, RFM e recuperação de carrinho abandonado.",
  },
  {
    icon: FileText,
    title: "Fiscal integrado",
    description: "Emissão de NF-e automática via Focus NFe, sem surpresas na Receita.",
  },
  {
    icon: BarChart3,
    title: "Analytics 360",
    description: "Health score da operação, alertas em tempo real e visão cruzada de todos os módulos.",
  },
  {
    icon: Shield,
    title: "Operação gerenciada",
    description: "Especialistas Orbia operam sua loja — você acompanha resultados no portal.",
  },
] as const;

const plans = [
  {
    id: "launch",
    name: "Launch",
    price: 3500,
    description: "Para lojas iniciando a operação profissional.",
    features: [
      "1 canal de venda conectado",
      "Gestão de pedidos e estoque",
      "NF-e automática",
      "Portal do lojista",
      "Suporte por email",
    ],
    highlighted: false,
  },
  {
    id: "growth",
    name: "Growth",
    price: 9000,
    description: "Para marcas em escala com tráfego e retenção ativos.",
    features: [
      "Até 3 canais omnichannel",
      "Tráfego Meta + Google",
      "Automações de retenção",
      "Health score e alertas",
      "Customer success dedicado",
    ],
    highlighted: true,
  },
  {
    id: "scale",
    name: "Scale",
    price: 18000,
    description: "Operação completa para alto volume e múltiplos canais.",
    features: [
      "Canais ilimitados",
      "Equipe de operação ampliada",
      "Analytics avançado + QBR",
      "Prioridade em integrações",
      "Modelo híbrido + % GMV",
    ],
    highlighted: false,
  },
] as const;

const stats = [
  { value: "6x", label: "ROAS meta da carteira" },
  { value: "4+", label: "Marketplaces integrados" },
  { value: "<5s", label: "Resposta de webhooks" },
  { value: "24/7", label: "Monitoramento operacional" },
] as const;

function SalesNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <div className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-lg bg-primary-gradient text-sm font-bold text-primary-foreground shadow-primary-glow">
            O
          </span>
          <span className="text-lg font-bold tracking-tight">Orbia</span>
        </div>
        <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
          <a href="#recursos" className="transition-colors hover:text-foreground">
            Recursos
          </a>
          <a href="#planos" className="transition-colors hover:text-foreground">
            Planos
          </a>
          <a href="#como-funciona" className="transition-colors hover:text-foreground">
            Como funciona
          </a>
        </nav>
        <div className="flex items-center gap-3">
          <Link
            to="/login"
            className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline"
          >
            Entrar
          </Link>
          <Link
            to="/diagnostico"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-primary/40 px-4 text-sm font-semibold text-primary transition-all hover:bg-primary/10"
          >
            Diagnóstico gratuito
          </Link>
          <Link
            to="/login"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary-gradient px-4 text-sm font-semibold text-primary-foreground shadow-primary-glow transition-all hover:brightness-110"
          >
            Agendar demo
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </div>
    </header>
  );
}

function HeroSection() {
  return (
    <section className="mx-auto max-w-6xl px-6 pb-20 pt-16 md:pt-24">
      <div className="mx-auto max-w-3xl text-center">
        <p className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          <Zap className="size-3" />
          E-commerce gerenciado para marcas brasileiras
        </p>
        <h1 className="text-4xl font-bold leading-tight tracking-tight text-foreground md:text-5xl lg:text-6xl">
          Sua loja operada por especialistas.{" "}
          <span className="text-primary">Você foca na marca.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">
          Tráfego, logística, fiscal, retenção e analytics em uma operação só — com equipe
          dedicada e painel em tempo real.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            to="/login"
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary-gradient px-6 text-sm font-semibold text-primary-foreground shadow-primary-glow transition-all hover:brightness-110 sm:w-auto"
          >
            Começar agora
            <ArrowRight className="size-4" />
          </Link>
          <a
            href="#planos"
            className="inline-flex h-11 w-full items-center justify-center rounded-lg border border-border bg-card px-6 text-sm font-medium text-foreground transition-colors hover:bg-muted/50 sm:w-auto"
          >
            Ver planos
          </a>
        </div>
      </div>

      <div className="mt-16 grid grid-cols-2 gap-4 md:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="surface-card rounded-xl p-5 text-center">
            <p className="font-mono text-2xl font-bold text-primary">{stat.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function FeaturesSection() {
  return (
    <section id="recursos" className="border-t border-border bg-card/30 py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight">Operação completa, um painel</h2>
          <p className="mt-3 text-muted-foreground">
            Do clique no anúncio à NF-e e ao pós-venda — tudo conectado e monitorado.
          </p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div key={feature.title} className="surface-card rounded-xl p-6">
              <feature.icon className="mb-4 size-5 text-primary" />
              <h3 className="font-semibold text-foreground">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorksSection() {
  const steps = [
    {
      step: "01",
      title: "Conectamos seus canais",
      description: "Shopify, Nuvemshop, marketplaces, Meta Ads e Google Ads em dias, não meses.",
    },
    {
      step: "02",
      title: "Operamos no dia a dia",
      description: "Pedidos, estoque, campanhas, NF-e e automações rodando com SLA e alertas.",
    },
    {
      step: "03",
      title: "Você acompanha no portal",
      description: "Health score, GMV, ROAS e pedidos em tempo real — sem planilha.",
    },
  ] as const;

  return (
    <section id="como-funciona" className="py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight">Como funciona</h2>
          <p className="mt-3 text-muted-foreground">
            Modelo ECaaS: nós operamos, você decide estratégia e aprova o que importa.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {steps.map((item) => (
            <div key={item.step} className="relative surface-card rounded-xl p-6">
              <span className="font-mono text-xs font-semibold text-primary">{item.step}</span>
              <h3 className="mt-3 text-lg font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PricingSection() {
  return (
    <section id="planos" className="border-t border-border bg-card/30 py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight">Planos transparentes</h2>
          <p className="mt-3 text-muted-foreground">
            Mensalidade fixa. Sem surpresas. Escale conforme o volume da sua operação.
          </p>
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={cn(
                "surface-card flex flex-col rounded-xl p-6",
                plan.highlighted && "border-primary/50 ring-1 ring-primary/30",
              )}
            >
              {plan.highlighted && (
                <span className="mb-4 w-fit rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-medium text-primary">
                  Mais popular
                </span>
              )}
              <h3 className="text-lg font-semibold">{plan.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
              <div className="mt-5 flex items-baseline gap-1">
                <span className="font-mono text-3xl font-bold text-foreground">
                  {formatBRL(plan.price)}
                </span>
                <span className="text-sm text-muted-foreground">/mês</span>
              </div>
              <ul className="mt-6 flex-1 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Link
                to="/login"
                className={cn(
                  "mt-8 inline-flex h-10 items-center justify-center rounded-lg text-sm font-medium transition-colors",
                  plan.highlighted
                    ? "bg-primary-gradient text-primary-foreground shadow-primary-glow hover:brightness-110"
                    : "border border-border-strong bg-background hover:bg-muted/50",
                )}
              >
                Falar com vendas
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CtaSection() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="surface-card rounded-2xl px-8 py-14 text-center md:px-16">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Pronto para escalar com operação de verdade?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Agende uma demonstração e veja como a Orbia pode assumir a operação da sua loja
            enquanto você cresce.
          </p>
          <Link
            to="/login"
            className="mt-8 inline-flex h-11 items-center gap-2 rounded-lg bg-primary-gradient px-8 text-sm font-semibold text-primary-foreground shadow-primary-glow transition-all hover:brightness-110"
          >
            Agendar demonstração gratuita
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function SalesFooter() {
  return (
    <footer className="border-t border-border py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 text-sm text-muted-foreground md:flex-row">
        <div className="flex items-center gap-2">
          <span className="grid size-7 place-items-center rounded-md bg-primary-gradient text-xs font-bold text-primary-foreground">
            O
          </span>
          <span>Orbia — Centro de Operações</span>
        </div>
        <p>© {new Date().getFullYear()} Orbia. Todos os direitos reservados.</p>
        <Link to="/login" className="transition-colors hover:text-foreground">
          Área do cliente
        </Link>
      </div>
    </footer>
  );
}

export function SalesPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SalesNav />
      <main>
        <HeroSection />
        <FeaturesSection />
        <HowItWorksSection />
        <PricingSection />
        <CtaSection />
      </main>
      <SalesFooter />
    </div>
  );
}
