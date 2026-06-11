export interface TemplateContext {
  nome?: string;
  produto?: string;
  valor?: string;
  rastreio?: string;
  checkout_url?: string;
  loja?: string;
  pedido_id?: string;
  danfe_url?: string;
  pontos?: string;
  cupom?: string;
  [key: string]: string | undefined;
}

export function renderTemplate(template: string, ctx: TemplateContext): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => ctx[key] ?? "");
}

export function buildTemplateContext(input: {
  customerName?: string | null;
  storeName?: string;
  productName?: string;
  valueCents?: number;
  trackingCode?: string;
  checkoutUrl?: string;
  orderId?: string;
  danfeUrl?: string;
  points?: number;
  couponCode?: string;
}): TemplateContext {
  const formatBRL = (cents: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

  return {
    nome: input.customerName ?? "cliente",
    produto: input.productName ?? "seu produto",
    valor: input.valueCents != null ? formatBRL(input.valueCents) : "",
    rastreio: input.trackingCode ?? "",
    checkout_url: input.checkoutUrl ?? "",
    loja: input.storeName ?? "nossa loja",
    pedido_id: input.orderId ?? "",
    danfe_url: input.danfeUrl ?? "",
    pontos: input.points != null ? String(input.points) : "",
    cupom: input.couponCode ?? "",
  };
}
