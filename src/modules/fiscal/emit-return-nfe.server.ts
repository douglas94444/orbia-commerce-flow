import { getServerConfig } from "@/lib/config.server";
import { emitNFeWithRetry } from "@/integrations/focus-nfe";
import type { FocusNfePayload } from "@/integrations/focus-nfe";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logAudit } from "@/shared/lib/logger";
import {
  applyDestinatarioToPayload,
  extractShippingFromMetadata,
} from "./nfe-destinatario.server";
import { uploadNfeXmlToStorage } from "./nfe-storage.server";
import {
  enrichReturnItemFiscal,
  loadProductFiscalBySkus,
  type ProductFiscalConfigDefaults,
} from "./product-fiscal.server";
import { resolveLocalDestino } from "./tax-engine.server";

export async function emitNfeForReturn(returnRequestId: string): Promise<void> {
  const { focusNfe } = getServerConfig();
  if (!focusNfe.token) {
    console.warn("[fiscal] FOCUS_NFE_TOKEN not set — skipping return NF-e");
    return;
  }

  const { data: req, error } = await supabaseAdmin
    .from("return_requests")
    .select(
      "id, client_id, order_id, orders(value_cents, metadata, external_id), return_items(sku, qty)",
    )
    .eq("id", returnRequestId)
    .single();

  if (error || !req) throw new Error(`Return request ${returnRequestId} not found`);

  const order = req.orders as {
    value_cents: number;
    metadata: Record<string, unknown>;
    external_id: string;
  };
  const clientId = req.client_id as string;

  const { data: fiscal } = await supabaseAdmin
    .from("fiscal_configs")
    .select(
      "cnpj, company_name, cert_path, default_cfop, default_cst, default_ncm, state_uf, state_registration, tax_regime",
    )
    .eq("client_id", clientId)
    .maybeSingle();

  if (!fiscal) throw new Error("Fiscal config not found for client");

  const items = (req.return_items ?? []) as Array<{ sku: string; qty: number }>;
  const shipping = extractShippingFromMetadata(order.metadata);
  const today = new Date().toISOString().slice(0, 10);
  const destUf = (shipping.state ?? "SP").slice(0, 2).toUpperCase();
  const localDestino = resolveLocalDestino(fiscal.state_uf ?? "SP", destUf);

  const skus = items.map((i) => i.sku).filter(Boolean);
  const productFiscal = await loadProductFiscalBySkus(clientId, skus);

  const fiscalDefaults: ProductFiscalConfigDefaults = {
    default_cfop: fiscal.default_cfop,
    default_cst: fiscal.default_cst,
    default_ncm: fiscal.default_ncm,
    state_uf: fiscal.state_uf ?? "SP",
    tax_regime: (fiscal.tax_regime as string) ?? "simples",
  };

  const ref = `orbia-dev-${clientId.slice(0, 8)}-${returnRequestId.slice(0, 8)}`.replace(
    /[^a-zA-Z0-9-]/g,
    "-",
  );

  const unitCents = items.length
    ? Math.floor(order.value_cents / items.reduce((s, i) => s + i.qty, 0))
    : order.value_cents;

  const nfeItems = items.map((item, idx) => {
    const enriched = enrichReturnItemFiscal(
      item.sku,
      item.qty,
      unitCents,
      productFiscal.get(item.sku),
      fiscalDefaults,
      localDestino,
      destUf,
    );
    return { ...enriched, numero_item: String(idx + 1) };
  });

  const payload: FocusNfePayload = {
    natureza_operacao: "Devolucao de mercadoria",
    data_emissao: today,
    tipo_documento: "1",
    local_destino: localDestino,
    finalidade_emissao: "4",
    consumidor_final: "1",
    presenca_comprador: "2",
    cnpj_emitente: fiscal.cnpj.replace(/\D/g, ""),
    inscricao_estadual_emitente: fiscal.state_registration ?? undefined,
    nome_destinatario: shipping.name ?? "Consumidor Final",
    logradouro_destinatario: shipping.street ?? "Rua Teste",
    numero_destinatario: shipping.number ?? "100",
    bairro_destinatario: shipping.neighborhood ?? "Centro",
    municipio_destinatario: shipping.city ?? "Sao Paulo",
    uf_destinatario: destUf,
    cep_destinatario: (shipping.postalCode ?? "01310100").replace(/\D/g, "").slice(0, 8),
    items: nfeItems,
  };

  const finalPayload = applyDestinatarioToPayload(payload, shipping, focusNfe.env);

  const { data: emission, error: insertError } = await supabaseAdmin
    .from("nfe_emissions")
    .insert({
      client_id: clientId,
      order_id: req.order_id,
      external_ref: ref,
      type: "NF-e",
      status: "pendente",
      value_cents: order.value_cents,
    })
    .select("id")
    .single();

  if (insertError) throw new Error(insertError.message);

  try {
    const result = await emitNFeWithRetry(ref, finalPayload, focusNfe.token);
    let xmlUrl = result.caminho_xml_nota_fiscal ?? null;
    const storedXml = xmlUrl
      ? await uploadNfeXmlToStorage(clientId, ref, xmlUrl)
      : null;
    if (storedXml) xmlUrl = storedXml;

    await supabaseAdmin
      .from("nfe_emissions")
      .update({
        status: "autorizada",
        access_key: result.chave_nfe ?? null,
        danfe_url: result.caminho_danfe ?? null,
        xml_url: xmlUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", emission.id);

    await logAudit({
      user_id: "system",
      client_id: clientId,
      action: "create",
      resource: "nfe_emission",
      resource_id: emission.id as string,
      new_data: { type: "devolucao", return_request_id: returnRequestId },
    });
  } catch (err) {
    await supabaseAdmin
      .from("nfe_emissions")
      .update({
        status: "rejeitada",
        last_error: (err as Error).message,
        retries: 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", emission.id);
    throw err;
  }
}
