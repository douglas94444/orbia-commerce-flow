import type { FocusNfePayload } from "@/integrations/focus-nfe";
import type { NormalizedOrderItem } from "@/modules/logistics/order-ingestion.server";
import {
  applyDestinatarioToPayload,
  extractShippingFromMetadata,
} from "./nfe-destinatario.server";
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
  order: { value_cents: number; metadata: Record<string, unknown> },
  focusEnv: string,
): Promise<FocusNfePayload> {
  const today = new Date().toISOString().slice(0, 10);
  const shipping = extractShippingFromMetadata(order.metadata);
  const destUf = (shipping.state ?? "SP").slice(0, 2).toUpperCase();
  const localDestino = resolveLocalDestino(fiscal.state_uf ?? "SP", destUf);

  const items = (order.metadata.items ?? []) as NormalizedOrderItem[];
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
          return buildFocusNfeItemFromEnriched(enriched, i, fiscalDefaults);
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
          ),
        ];

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
    nome_destinatario: shipping.name ?? "Consumidor Final",
    cpf_destinatario: focusEnv !== "producao" ? "00000000191" : undefined,
    logradouro_destinatario: shipping.street ?? "Rua Teste",
    numero_destinatario: shipping.number ?? "100",
    bairro_destinatario: shipping.neighborhood ?? "Centro",
    municipio_destinatario: shipping.city ?? "Sao Paulo",
    uf_destinatario: destUf,
    cep_destinatario: (shipping.postalCode ?? "01310100").replace(/\D/g, "").slice(0, 8),
    items: nfeItems,
  };

  return applyDestinatarioToPayload(base, shipping, focusEnv);
}
