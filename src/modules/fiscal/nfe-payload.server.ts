import type { FocusNfePayload } from "@/integrations/focus-nfe";

import type { NormalizedOrderItem } from "@/modules/logistics/order-ingestion.server";

import {

  applyDestinatarioToPayload,

  extractShippingFromMetadata,

  validateDestinatarioForProduction,

} from "./nfe-destinatario.server";

import {

  buildInformacoesComplementares,

  resolveMarketplaceIntermediador,

  resolvePaymentFromMetadata,

} from "./nfe-marketplace.server";

import {

  extractOrderTotalsFromMetadata,

  resolveModalidadeFrete,

  validateOrderTotals,

} from "./nfe-order-totals.server";

import {

  buildFocusNfeItemFromEnriched,

  enrichSaleItemFiscal,

  loadProductFiscalBySkus,

  type ProductFiscalConfigDefaults,

} from "./product-fiscal.server";

import { resolveLocalDestino } from "./tax-engine.server";



export interface FiscalConfigForPayload {

  cnpj: string;

  company_name: string;

  default_cfop: string | null;

  default_cst: string | null;

  default_ncm: string | null;

  state_uf: string;

  state_registration: string | null;

  tax_regime: string;

}



export async function buildNfePayloadForOrder(

  clientId: string,

  fiscal: FiscalConfigForPayload,

  order: {

    value_cents: number;

    metadata: Record<string, unknown>;

    channel?: string | null;

  },

  focusEnv: string,

): Promise<FocusNfePayload> {

  const today = new Date().toISOString().slice(0, 10);

  const shipping = extractShippingFromMetadata(order.metadata);

  const destUf = (shipping.state ?? fiscal.state_uf ?? "SP").slice(0, 2).toUpperCase();

  const localDestino = resolveLocalDestino(fiscal.state_uf ?? "SP", destUf);



  const destValidation = validateDestinatarioForProduction(shipping, focusEnv);

  if (!destValidation.ok) {

    throw new Error(`Destinatário incompleto: ${destValidation.errors.join(", ")}`);

  }



  const items = (order.metadata.items ?? []) as NormalizedOrderItem[];

  const totals = extractOrderTotalsFromMetadata(order.metadata, order.value_cents, items);
  const hasBreakdown =
    order.metadata.shipping_cents != null || order.metadata.discount_cents != null;
  if (items.length > 0) {
    validateOrderTotals(totals, order.value_cents, Boolean(hasBreakdown));
  }

  const skus = items.map((i) => i.sku).filter(Boolean);

  const productFiscal = await loadProductFiscalBySkus(clientId, skus);



  const fiscalDefaults: ProductFiscalConfigDefaults = {

    default_cfop: fiscal.default_cfop,

    default_cst: fiscal.default_cst,

    default_ncm: fiscal.default_ncm,

    state_uf: fiscal.state_uf ?? "SP",

    tax_regime: fiscal.tax_regime,

  };



  const nfeItems =

    items.length > 0

      ? items.map((item, i) => {

          const enriched = enrichSaleItemFiscal(

            item,

            productFiscal.get(item.sku),

            fiscalDefaults,

            localDestino,

            destUf,

          );

          return buildFocusNfeItemFromEnriched(enriched, i, fiscalDefaults, localDestino);

        })

      : [

          buildFocusNfeItemFromEnriched(

            enrichSaleItemFiscal(

              {

                sku: "PROD001",

                name: "Venda de mercadoria",

                quantity: 1,

                unitPriceCents: order.value_cents,

              },

              undefined,

              fiscalDefaults,

              localDestino,

              destUf,

            ),

            0,

            fiscalDefaults,

            localDestino,

          ),

        ];



  const intermediador = resolveMarketplaceIntermediador(order.channel);

  const payment = resolvePaymentFromMetadata(order.metadata);

  const isHomolog = focusEnv !== "producao";



  const base: FocusNfePayload = {

    natureza_operacao: "Venda de mercadoria",

    data_emissao: today,

    tipo_documento: "1",

    local_destino: localDestino,

    finalidade_emissao: "1",

    consumidor_final: "1",

    presenca_comprador: "2",

    cnpj_emitente: fiscal.cnpj.replace(/\D/g, ""),

    inscricao_estadual_emitente: fiscal.state_registration ?? undefined,

    nome_destinatario: shipping.name ?? (isHomolog ? "NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO" : "Consumidor Final"),

    logradouro_destinatario: shipping.street ?? (isHomolog ? "Rua Teste" : ""),

    numero_destinatario: shipping.number ?? (isHomolog ? "100" : "S/N"),

    bairro_destinatario: shipping.neighborhood ?? (isHomolog ? "Centro" : ""),

    municipio_destinatario: shipping.city ?? (isHomolog ? "Sao Paulo" : ""),

    uf_destinatario: destUf,

    cep_destinatario: (shipping.postalCode ?? (isHomolog ? "01310100" : "")).replace(/\D/g, "").slice(0, 8),

    modalidade_frete: resolveModalidadeFrete(totals.shippingCents),

    valor_frete: totals.shippingCents > 0 ? totals.shippingCents / 100 : undefined,

    valor_desconto: totals.discountCents > 0 ? totals.discountCents / 100 : undefined,

    forma_pagamento: payment.formaPagamento,

    meio_pagamento: payment.meioPagamento,

    informacoes_adicionais_contribuinte: buildInformacoesComplementares(

      order.metadata,

      order.channel,

    ),

    indicador_intermediador: intermediador.indicador,

    cnpj_intermediador: intermediador.cnpj,

    items: nfeItems,

  };



  return applyDestinatarioToPayload(base, shipping, focusEnv);

}

