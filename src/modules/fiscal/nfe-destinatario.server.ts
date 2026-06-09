import type { FocusNfePayload } from "@/integrations/focus-nfe";
import type { NormalizedOrderItem } from "@/modules/logistics/order-ingestion.server";

export interface OrderShippingMeta {
  name?: string;
  cpf?: string;
  cnpj?: string;
  street?: string;
  number?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  postalCode?: string;
}

export function extractShippingFromMetadata(
  metadata: Record<string, unknown>,
): OrderShippingMeta {
  const shipping = (metadata.shipping ?? {}) as OrderShippingMeta;
  return {
    name: shipping.name,
    cpf: shipping.cpf,
    cnpj: shipping.cnpj,
    street: shipping.street,
    number: shipping.number,
    neighborhood: shipping.neighborhood,
    city: shipping.city,
    state: shipping.state,
    postalCode: shipping.postalCode ?? (metadata.postal_code as string | undefined),
  };
}

function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export function applyDestinatarioToPayload(
  payload: FocusNfePayload,
  shipping: OrderShippingMeta,
  focusEnv: string,
): FocusNfePayload {
  const isHomolog = focusEnv !== "producao";

  if (isHomolog && !shipping.cpf && !shipping.cnpj) {
    return payload;
  }

  const cpf = shipping.cpf ? onlyDigits(shipping.cpf) : undefined;
  const cnpj = shipping.cnpj ? onlyDigits(shipping.cnpj) : undefined;

  return {
    ...payload,
    nome_destinatario: shipping.name?.slice(0, 60) ?? payload.nome_destinatario,
    cpf_destinatario: cpf && cpf.length === 11 ? cpf : payload.cpf_destinatario,
    cnpj_destinatario: cnpj && cnpj.length === 14 ? cnpj : undefined,
    logradouro_destinatario: shipping.street?.slice(0, 60) ?? payload.logradouro_destinatario,
    numero_destinatario: shipping.number?.slice(0, 10) ?? payload.numero_destinatario,
    bairro_destinatario: shipping.neighborhood?.slice(0, 60) ?? payload.bairro_destinatario,
    municipio_destinatario: shipping.city?.slice(0, 60) ?? payload.municipio_destinatario,
    uf_destinatario: (shipping.state ?? payload.uf_destinatario).slice(0, 2).toUpperCase(),
    cep_destinatario: onlyDigits(shipping.postalCode ?? payload.cep_destinatario).slice(0, 8),
  };
}

export function buildNfeItemsFromOrder(
  order: { value_cents: number; metadata: { items?: NormalizedOrderItem[] } },
  fiscal: { default_cfop: string | null; default_cst: string | null; default_ncm: string | null },
): FocusNfePayload["items"] {
  const items = order.metadata?.items ?? [];
  const cfop = fiscal.default_cfop ?? "5102";
  const ncm = fiscal.default_ncm ?? "61091000";
  const cst = fiscal.default_cst ?? "102";

  if (items.length) {
    return items.map((item, i) => ({
      numero_item: String(i + 1),
      codigo_produto: item.sku,
      descricao: item.name.slice(0, 120),
      cfop,
      unidade_comercial: "UN",
      quantidade_comercial: item.quantity,
      valor_unitario_comercial: item.unitPriceCents / 100,
      valor_bruto: (item.unitPriceCents * item.quantity) / 100,
      codigo_ncm: item.ncm ?? ncm,
      icms_situacao_tributaria: cst,
      icms_origem: "0",
    }));
  }

  return [
    {
      numero_item: "1",
      codigo_produto: "PROD001",
      descricao: "Venda de mercadoria",
      cfop,
      unidade_comercial: "UN",
      quantidade_comercial: 1,
      valor_unitario_comercial: order.value_cents / 100,
      valor_bruto: order.value_cents / 100,
      codigo_ncm: ncm,
      icms_situacao_tributaria: cst,
      icms_origem: "0",
    },
  ];
}
