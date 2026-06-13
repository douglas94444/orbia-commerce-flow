import type { FocusNfcePayload } from "@/integrations/focus-nfe";
import type { NormalizedOrderItem } from "@/modules/logistics/order-ingestion.server";
import { extractShippingFromMetadata } from "./nfe-destinatario.server";
import { resolvePaymentFromMetadata } from "./nfe-marketplace.server";
import { extractOrderTotalsFromMetadata, resolveModalidadeFrete } from "./nfe-order-totals.server";
import {
  buildFocusNfeItemFromEnriched,
  enrichSaleItemFiscal,
  loadProductFiscalBySkus,
  type ProductFiscalConfigDefaults,
} from "./product-fiscal.server";
import { resolveLocalDestino, loadClientTaxRules, findTaxRuleFromList } from "./tax-engine.server";
import type { FiscalConfigForPayload } from "./nfe-payload.server";

export interface NfceSettings {
  csc_id?: string | null;
  csc_token?: string | null;
  presenca_default?: string;
}

export async function buildNfcePayloadForOrder(
  clientId: string,
  fiscal: FiscalConfigForPayload,
  order: {
    value_cents: number;
    metadata: Record<string, unknown>;
    channel?: string | null;
  },
  focusEnv: string,
  nfceSettings: NfceSettings,
  series: { serie: string; number: number },
): Promise<FocusNfcePayload> {
  const today = new Date().toISOString().slice(0, 10);
  const shipping = extractShippingFromMetadata(order.metadata);
  const destUf = (fiscal.state_uf ?? "SP").slice(0, 2).toUpperCase();
  const localDestino = resolveLocalDestino(fiscal.state_uf ?? "SP", destUf);
  const isHomolog = focusEnv !== "producao";

  const items = (order.metadata.items ?? []) as NormalizedOrderItem[];
  const totals = extractOrderTotalsFromMetadata(order.metadata, order.value_cents, items);
  const skus = items.map((i) => i.sku).filter(Boolean);
  const productFiscal = await loadProductFiscalBySkus(clientId, skus);
  const taxRules = await loadClientTaxRules(clientId);

  const fiscalDefaults: ProductFiscalConfigDefaults = {
    default_cfop: fiscal.default_cfop ?? "5102",
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
            findTaxRuleFromList(
              taxRules,
              destUf,
              productFiscal.get(item.sku)?.ncm ?? fiscal.default_ncm ?? "",
            ),
          );
          const taxRule = findTaxRuleFromList(
            taxRules,
            destUf,
            productFiscal.get(item.sku)?.ncm ?? fiscal.default_ncm ?? "",
          );
          return buildFocusNfeItemFromEnriched(enriched, i, fiscalDefaults, localDestino, taxRule);
        })
      : [
          buildFocusNfeItemFromEnriched(
            enrichSaleItemFiscal(
              {
                sku: "PDV001",
                name: "Venda balcão",
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

  const payment = resolvePaymentFromMetadata(order.metadata);

  return {
    natureza_operacao: "Venda ao consumidor",
    data_emissao: today,
    tipo_documento: "1",
    local_destino: "1",
    finalidade_emissao: "1",
    consumidor_final: "1",
    presenca_comprador: nfceSettings.presenca_default ?? "1",
    cnpj_emitente: fiscal.cnpj.replace(/\D/g, ""),
    inscricao_estadual_emitente: fiscal.state_registration ?? undefined,
    nome_destinatario: shipping.name ?? (isHomolog ? "NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO" : "Consumidor"),
    cpf_destinatario: shipping.cpf?.replace(/\D/g, "") ?? (isHomolog ? "00000000191" : undefined),
    logradouro_destinatario: shipping.street ?? (isHomolog ? "Rua Teste" : "N/A"),
    numero_destinatario: shipping.number ?? (isHomolog ? "100" : "S/N"),
    bairro_destinatario: shipping.neighborhood ?? (isHomolog ? "Centro" : "N/A"),
    municipio_destinatario: shipping.city ?? (isHomolog ? "Sao Paulo" : fiscal.state_uf ?? "SP"),
    uf_destinatario: destUf,
    cep_destinatario: (shipping.postalCode ?? (isHomolog ? "01310100" : "00000000"))
      .replace(/\D/g, "")
      .slice(0, 8),
    modalidade_frete: resolveModalidadeFrete(totals.shippingCents),
    valor_frete: totals.shippingCents > 0 ? totals.shippingCents / 100 : undefined,
    valor_desconto: totals.discountCents > 0 ? totals.discountCents / 100 : undefined,
    forma_pagamento: payment.formaPagamento,
    meio_pagamento: payment.meioPagamento,
    indicador_intermediador: "0",
    serie: series.serie,
    numero: String(series.number),
    items: nfeItems,
  };
}
