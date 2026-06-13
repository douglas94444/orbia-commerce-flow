import type { FocusNfePayload } from "@/integrations/focus-nfe";
import type { NormalizedOrderItem } from "@/modules/logistics/order-ingestion.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  applyDestinatarioToPayload,
  buildNfeItemsFromOrder,
  extractShippingFromMetadata,
} from "./nfe-destinatario.server";
import {
  resolveLocalDestino,
  resolveSaleCfop,
  type ProductFiscalRow,
} from "./tax-engine.server";

export interface FiscalConfigForPayload {
  cnpj: string;
  company_name: string;
  cert_path: string | null;
  default_cfop: string | null;
  default_cst: string | null;
  default_ncm: string | null;
  state_uf: string;
  tax_regime: string;
}

async function loadProductFiscalBySkus(
  clientId: string,
  skus: string[],
): Promise<Map<string, ProductFiscalRow>> {
  const map = new Map<string, ProductFiscalRow>();
  if (skus.length === 0) return map;

  const { data } = await supabaseAdmin
    .from("products")
    .select("sku, ncm, cfop, cst")
    .eq("client_id", clientId)
    .in("sku", skus);

  for (const row of data ?? []) {
    map.set(row.sku as string, {
      sku: row.sku as string,
      ncm: row.ncm as string | null,
      cfop: row.cfop as string | null,
      cst: row.cst as string | null,
    });
  }
  return map;
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

  const enrichedItems = items.map((item) => {
    const pf = productFiscal.get(item.sku);
    const cfop = resolveSaleCfop(localDestino, fiscal.default_cfop, pf?.cfop ?? item.cfop ?? null);
    const cst = pf?.cst ?? fiscal.default_cst ?? "102";
    const ncm = pf?.ncm ?? item.ncm ?? fiscal.default_ncm ?? "61091000";
    return { ...item, cfop, cst, ncm };
  });

  const orderWithItems = {
    value_cents: order.value_cents,
    metadata: {
      ...(order.metadata as object),
      items: enrichedItems.length ? enrichedItems : undefined,
    },
  };

  const base: FocusNfePayload = {
    natureza_operacao: "Venda de mercadoria",
    data_emissao: today,
    tipo_documento: "1",
    local_destino: localDestino,
    finalidade_emissao: "1",
    consumidor_final: "1",
    presenca_comprador: "2",
    cnpj_emitente: fiscal.cnpj,
    nome_destinatario: shipping.name ?? "Consumidor Final",
    cpf_destinatario: focusEnv !== "producao" ? "00000000191" : undefined,
    logradouro_destinatario: shipping.street ?? "Rua Teste",
    numero_destinatario: shipping.number ?? "100",
    bairro_destinatario: shipping.neighborhood ?? "Centro",
    municipio_destinatario: shipping.city ?? "Sao Paulo",
    uf_destinatario: destUf,
    cep_destinatario: (shipping.postalCode ?? "01310100").replace(/\D/g, "").slice(0, 8),
    items: buildNfeItemsFromOrder(orderWithItems, fiscal),
  };

  if (fiscal.cert_path && focusEnv === "producao") {
    base.certificado = fiscal.cert_path;
  }

  return applyDestinatarioToPayload(base, shipping, focusEnv);
}
