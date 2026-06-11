import { getServerConfig } from "@/lib/config.server";
import { emitNFeWithRetry } from "@/integrations/focus-nfe";
import type { FocusNfePayload } from "@/integrations/focus-nfe";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logAudit } from "@/shared/lib/logger";
import { emitDomainEvent } from "@/shared/lib/domain-events.server";
import type { NormalizedOrderItem } from "@/modules/logistics/order-ingestion.server";
import {
  applyDestinatarioToPayload,
  buildNfeItemsFromOrder,
  extractShippingFromMetadata,
} from "./nfe-destinatario.server";
import { uploadNfeXmlToStorage } from "./nfe-storage.server";

function buildNfePayload(
  fiscal: {
    cnpj: string;
    company_name: string;
    cert_path: string | null;
    default_cfop: string | null;
    default_cst: string | null;
    default_ncm: string | null;
  },
  order: { value_cents: number; metadata: Record<string, unknown> },
  focusEnv: string,
): FocusNfePayload {
  const today = new Date().toISOString().slice(0, 10);
  const shipping = extractShippingFromMetadata(order.metadata);

  const base: FocusNfePayload = {
    natureza_operacao: "Venda de mercadoria",
    data_emissao: today,
    tipo_documento: "1",
    local_destino: "1",
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
    uf_destinatario: (shipping.state ?? "SP").slice(0, 2).toUpperCase(),
    cep_destinatario: (shipping.postalCode ?? "01310100").replace(/\D/g, "").slice(0, 8),
    items: buildNfeItemsFromOrder(
      { value_cents: order.value_cents, metadata: order.metadata as { items?: NormalizedOrderItem[] } },
      fiscal,
    ),
  };

  if (fiscal.cert_path && focusEnv === "producao") {
    base.certificado = fiscal.cert_path;
  }

  return applyDestinatarioToPayload(base, shipping, focusEnv);
}

export async function emitNfeForOrder(orderId: string): Promise<void> {
  const { focusNfe } = getServerConfig();
  if (!focusNfe.token) {
    console.warn("[fiscal] FOCUS_NFE_TOKEN not set — skipping emission");
    return;
  }

  const { data: order, error: orderError } = await supabaseAdmin
    .from("orders")
    .select("id, client_id, external_id, value_cents, nf_status, status, metadata")
    .eq("id", orderId)
    .single();

  if (orderError || !order) throw new Error(`Order ${orderId} not found`);
  if (order.nf_status === "autorizada") return;

  const { data: fiscal, error: fiscalError } = await supabaseAdmin
    .from("fiscal_configs")
    .select("cnpj, company_name, cert_path, default_cfop, default_cst, default_ncm")
    .eq("client_id", order.client_id)
    .maybeSingle();

  if (fiscalError || !fiscal) {
    throw new Error("Fiscal config not found for client — configure em /fiscal/config");
  }

  const ref = `orbia-${order.client_id.slice(0, 8)}-${order.external_id}`.replace(
    /[^a-zA-Z0-9-]/g,
    "-",
  );

  const { data: emission, error: insertError } = await supabaseAdmin
    .from("nfe_emissions")
    .insert({
      client_id: order.client_id,
      order_id: order.id,
      external_ref: ref,
      type: "NF-e",
      status: "pendente",
      value_cents: order.value_cents,
    })
    .select("id")
    .single();

  if (insertError) throw new Error(`Failed to create nfe_emissions row: ${insertError.message}`);

  const metadata = (order.metadata ?? {}) as Record<string, unknown>;
  const payload = buildNfePayload(fiscal, { value_cents: order.value_cents, metadata }, focusNfe.env);

  try {
    const result = await emitNFeWithRetry(ref, payload, focusNfe.token);

    let xmlUrl = result.caminho_xml_nota_fiscal ?? null;
    const storedXml = xmlUrl
      ? await uploadNfeXmlToStorage(order.client_id, ref, xmlUrl)
      : null;
    if (storedXml) xmlUrl = storedXml;

    await supabaseAdmin
      .from("nfe_emissions")
      .update({
        status: "autorizada",
        access_key: result.chave_nfe ?? null,
        xml_url: xmlUrl,
        danfe_url: result.caminho_danfe ?? null,
        authorized_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", emission.id);

    await supabaseAdmin
      .from("orders")
      .update({
        nf_status: "autorizada",
        status: "separacao",
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id);

    await supabaseAdmin.from("order_events").insert({
      order_id: order.id,
      status: "separacao",
      source: "fiscal",
      metadata: { nfe_ref: ref, chave: result.chave_nfe },
    });

    await logAudit({
      client_id: order.client_id,
      action: "nfe_emit",
      resource: "nfe_emission",
      resource_id: emission.id,
      new_data: { ref, status: result.status },
    });

    await emitDomainEvent("nfe.authorized", {
      orderId: order.id,
      clientId: order.client_id,
      danfeUrl: result.caminho_danfe ?? null,
      xmlUrl: xmlUrl,
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
