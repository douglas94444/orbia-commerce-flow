import { getServerConfig } from "@/lib/config.server";
import { emitNFSeWithRetry } from "@/integrations/focus-nfe";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logAudit } from "@/shared/lib/logger";
import { createNfeXmlSignedUrl, uploadNfeXmlToStorage } from "./nfe-storage.server";
import { validateFiscalReadiness } from "./fiscal-readiness.server";
import { reserveSeriesNumber } from "./fiscal-series.server";
import { buildNfsePayloadForOrder } from "./nfse-payload.server";

export function shouldEmitNfse(
  metadata: Record<string, unknown>,
): boolean {
  return metadata.service_only === true || metadata.emit_nfse === true;
}

export async function resolveDefaultService(clientId: string) {
  const { data } = await supabaseAdmin
    .from("fiscal_service_catalog")
    .select("item_lista_servico, codigo_tributacao_municipio, aliquota_iss, descricao, municipality_code")
    .eq("client_id", clientId)
    .order("is_default", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data;
}

export async function emitNfseForOrder(
  orderId: string,
  serviceDescription?: string,
): Promise<string> {
  const { focusNfe } = getServerConfig();
  if (!focusNfe.token) throw new Error("FOCUS_NFE_TOKEN não configurado");

  const { data: order, error: orderError } = await supabaseAdmin
    .from("orders")
    .select("id, client_id, external_id, value_cents, metadata")
    .eq("id", orderId)
    .single();

  if (orderError || !order) throw new Error(`Pedido ${orderId} não encontrado`);

  const readiness = await validateFiscalReadiness(order.client_id, { docType: "nfse" });
  if (!readiness.ready) {
    const missing = readiness.items
      .filter((i) => i.status === "error")
      .map((i) => i.label)
      .join(", ");
    throw new Error(`Configuração NFS-e incompleta: ${missing}`);
  }

  const { data: fiscal } = await supabaseAdmin
    .from("fiscal_configs")
    .select(
      "cnpj, company_name, state_uf, state_registration, municipal_registration, municipality_code, iss_retido, natureza_operacao_nfse, auto_emit_nfse",
    )
    .eq("client_id", order.client_id)
    .maybeSingle();

  if (!fiscal) throw new Error("Configuração fiscal não encontrada");

  const service = await resolveDefaultService(order.client_id);
  if (!service) throw new Error("Cadastre ao menos um serviço ISS em /fiscal/services");

  const ref = `orbia-nfse-${order.client_id.slice(0, 8)}-${order.external_id}`.replace(
    /[^a-zA-Z0-9-]/g,
    "-",
  );

  const series = await reserveSeriesNumber(order.client_id, "nfse", focusNfe.env);
  const metadata = (order.metadata ?? {}) as Record<string, unknown>;

  const payload = buildNfsePayloadForOrder(
    fiscal,
    { value_cents: order.value_cents, metadata, external_id: order.external_id },
    service,
    focusNfe.env,
    serviceDescription,
  );

  const { data: emission, error: insertError } = await supabaseAdmin
    .from("nfe_emissions")
    .insert({
      client_id: order.client_id,
      order_id: order.id,
      external_ref: ref,
      type: "NFS-e",
      status: "pendente",
      value_cents: order.value_cents,
      series: series.serie,
      number: series.number,
    })
    .select("id")
    .single();

  if (insertError) throw new Error(insertError.message);

  try {
    const result = await emitNFSeWithRetry(ref, payload, focusNfe.token);
    const storagePath = result.caminho_xml_nota_fiscal
      ? await uploadNfeXmlToStorage(order.client_id, ref, result.caminho_xml_nota_fiscal)
      : null;
    const xmlSigned = storagePath ? await createNfeXmlSignedUrl(storagePath) : null;

    await supabaseAdmin
      .from("nfe_emissions")
      .update({
        status: "autorizada",
        access_key: result.chave_nfe ?? null,
        xml_url: xmlSigned ?? result.caminho_xml_nota_fiscal ?? null,
        xml_storage_path: storagePath,
        danfe_url: result.caminho_danfe ?? null,
        authorized_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", emission.id);

    await logAudit({
      client_id: order.client_id,
      action: "nfse_emit",
      resource: "nfe_emission",
      resource_id: emission.id,
      new_data: { ref, chave: result.chave_nfe },
    });

    return emission.id;
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

export async function emitNfseForFulfillmentBilling(
  clientId: string,
  amountCents: number,
  periodMonth: string,
  transactionId: string,
): Promise<string | null> {
  const { focusNfe } = getServerConfig();
  if (!focusNfe.token) return null;

  const readiness = await validateFiscalReadiness(clientId, { docType: "nfse" });
  if (!readiness.ready) return null;

  const { data: fiscal } = await supabaseAdmin
    .from("fiscal_configs")
    .select(
      "cnpj, company_name, state_uf, municipal_registration, municipality_code, iss_retido, natureza_operacao_nfse, auto_emit_nfse",
    )
    .eq("client_id", clientId)
    .maybeSingle();

  if (!fiscal?.auto_emit_nfse) return null;

  const service = await resolveDefaultService(clientId);
  if (!service) return null;

  const ref = `orbia-nfse-fulfillment-${clientId.slice(0, 8)}-${periodMonth}`.replace(
    /[^a-zA-Z0-9-]/g,
    "-",
  );

  const { data: existing } = await supabaseAdmin
    .from("nfe_emissions")
    .select("id")
    .eq("external_ref", ref)
    .maybeSingle();

  if (existing) return existing.id;

  const series = await reserveSeriesNumber(clientId, "nfse", focusNfe.env);
  const payload = buildNfsePayloadForOrder(
    fiscal,
    {
      value_cents: amountCents,
      metadata: {
        shipping: { name: fiscal.company_name },
        billing_period: periodMonth,
      },
      external_id: periodMonth,
    },
    service,
    focusNfe.env,
    `Fulfillment Orbia — período ${periodMonth}`,
  );

  const { data: emission, error: insertError } = await supabaseAdmin
    .from("nfe_emissions")
    .insert({
      client_id: clientId,
      order_id: null,
      external_ref: ref,
      type: "NFS-e",
      status: "pendente",
      value_cents: amountCents,
      series: series.serie,
      number: series.number,
      metadata: { transaction_id: transactionId, period_month: periodMonth },
    })
    .select("id")
    .single();

  if (insertError) throw new Error(insertError.message);

  try {
    const result = await emitNFSeWithRetry(ref, payload, focusNfe.token);
    const storagePath = result.caminho_xml_nota_fiscal
      ? await uploadNfeXmlToStorage(clientId, ref, result.caminho_xml_nota_fiscal)
      : null;
    const xmlSigned = storagePath ? await createNfeXmlSignedUrl(storagePath) : null;

    await supabaseAdmin
      .from("nfe_emissions")
      .update({
        status: "autorizada",
        access_key: result.chave_nfe ?? null,
        xml_url: xmlSigned ?? result.caminho_xml_nota_fiscal ?? null,
        xml_storage_path: storagePath,
        danfe_url: result.caminho_danfe ?? null,
        authorized_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", emission.id);

    await supabaseAdmin
      .from("transactions")
      .update({ metadata: { nfe_emission_id: emission.id } })
      .eq("id", transactionId);

    return emission.id;
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
    console.error("[fiscal/nfse-fulfillment]", err);
    return null;
  }
}
