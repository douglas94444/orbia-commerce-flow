import type { MarketplaceChannel } from "@/modules/logistics/order-ingestion.server";

export interface MarketplaceIntermediador {
  indicador: "0" | "1";
  cnpj?: string;
}

const INTERMEDIADOR_CNPJ: Partial<Record<MarketplaceChannel, string>> = {
  mercado_livre: "03007331000141",
  shopee: "35635824000112",
  amazon: "15357085000104",
  tiktok: "42094295000144",
};

export function resolveMarketplaceIntermediador(
  channel: string | null | undefined,
): MarketplaceIntermediador {
  const cnpj = channel ? INTERMEDIADOR_CNPJ[channel as MarketplaceChannel] : undefined;
  if (!cnpj) return { indicador: "0" };
  return { indicador: "1", cnpj };
}

export interface OrderPaymentMeta {
  formaPagamento: string;
  meioPagamento: string;
}

export function resolvePaymentFromMetadata(metadata: Record<string, unknown>): OrderPaymentMeta {
  const method = String(
    metadata.payment_method ?? metadata.payment_type ?? metadata.payment_status ?? "outros",
  ).toLowerCase();

  if (method.includes("pix")) {
    return { formaPagamento: "0", meioPagamento: "17" };
  }
  if (method.includes("boleto")) {
    return { formaPagamento: "0", meioPagamento: "15" };
  }
  if (method.includes("credit") || method.includes("cartao") || method.includes("card")) {
    return { formaPagamento: "0", meioPagamento: "03" };
  }
  if (method.includes("debit")) {
    return { formaPagamento: "0", meioPagamento: "04" };
  }
  return { formaPagamento: "0", meioPagamento: "99" };
}

export function buildInformacoesComplementares(
  metadata: Record<string, unknown>,
  channel?: string | null,
): string {
  const parts: string[] = [];
  const extId = metadata.raw_id ?? metadata.external_id;
  if (extId) parts.push(`Pedido marketplace: ${extId}`);
  if (channel) parts.push(`Canal: ${channel}`);
  return parts.join(" | ").slice(0, 2000);
}
