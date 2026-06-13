import { getServerConfig } from "@/lib/config.server";
import { emitNFCe, emitNFCeWithRetry } from "@/integrations/focus-nfe";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logAudit } from "@/shared/lib/logger";
import { emitDomainEvent } from "@/shared/lib/domain-events.server";
import { createNfeXmlSignedUrl, uploadNfeXmlToStorage } from "./nfe-storage.server";
import { validateFiscalReadiness } from "./fiscal-readiness.server";
import { reserveSeriesNumber } from "./fiscal-series.server";
import { buildNfcePayloadForOrder } from "./nfce-payload.server";
import { validateProductFiscalForEmission } from "./product-fiscal-emission-validation.server";
import type { NormalizedOrderItem } from "@/modules/logistics/order-ingestion.server";

const PDV_CHANNELS = new Set(["loja_fisica", "pdv", "balcao"]);

export function shouldEmitNfce(
  channel: string | null | undefined,
  metadata: Record<string, unknown>,
): boolean {
  if (metadata.emit_nfce === true) return true;
  if (metadata.service_only === true) return false;
  return PDV_CHANNELS.has((channel ?? "").toLowerCase());
}

export async function emitNfceForOrder(orderId: string): Promise<string> {
  const { focusNfe } = getServerConfig();
  if (!focusNfe.token) throw new Error("FOCUS_NFE_TOKEN não configurado");

  const { data: order, error: orderError } = await supabaseAdmin
    .from("orders")
    .select("id, client_id, external_id, value_cents, nf_status, metadata, channel")
    .eq("id", orderId)
    .single();

  if (orderError || !order) throw new Error(`Pedido ${orderId} não encontrado`);

  const metadata = (order.metadata ?? {}) as Record<string, unknown>;

  const { data: fiscalFlags } = await supabaseAdmin
    .from("fiscal_configs")
    .select("auto_emit_nfce, nfce_csc_id, nfce_csc_token")
    .eq("client_id", order.client_id)
    .maybeSingle();

  if (fiscalFlags?.auto_emit_nfce === false && !shouldEmitNfce(order.channel, metadata)) {
    throw new Error("Emissão NFC-e desabilitada para este cliente");
  }

  const readiness = await validateFiscalReadiness(order.client_id, {
    attemptFocusSync: true,
    docType: "nfce",
  });
  if (!readiness.ready) {
    const missing = readiness.items
      .filter((i) => i.status === "error")
      .map((i) => i.label)
      .join(", ");
    throw new Error(`Configuração NFC-e incompleta: ${missing}`);
  }

  const { data: fiscal } = await supabaseAdmin
    .from("fiscal_configs")
    .select(
      "cnpj, company_name, default_cfop, default_cst, default_ncm, state_uf, state_registration, tax_regime, nfce_csc_id, nfce_csc_token",
    )
    .eq("client_id", order.client_id)
    .maybeSingle();

  if (!fiscal) throw new Error("Configuração fiscal não encontrada");

  const { data: nfceSettings } = await supabaseAdmin
    .from("fiscal_nfce_settings")
    .select("csc_id, csc_token, presenca_default")
    .eq("client_id", order.client_id)
    .maybeSingle();

  const orderItems = (metadata.items ?? []) as NormalizedOrderItem[];
  const productValidation = await validateProductFiscalForEmission(
    order.client_id,
    orderItems,
    fiscal.default_ncm,
    fiscal.tax_regime as string,
  );
  if (!productValidation.ok) throw new Error(productValidation.message);

  const ref = `orbia-nfce-${order.client_id.slice(0, 8)}-${order.external_id}`.replace(
    /[^a-zA-Z0-9-]/g,
    "-",
  );

  const series = await reserveSeriesNumber(order.client_id, "nfce", focusNfe.env);

  const { data: emission, error: insertError } = await supabaseAdmin
    .from("nfe_emissions")
    .insert({
      client_id: order.client_id,
      order_id: order.id,
      external_ref: ref,
      type: "NFC-e",
      status: "pendente",
      value_cents: order.value_cents,
      series: series.serie,
      number: series.number,
    })
    .select("id")
    .single();

  if (insertError) throw new Error(insertError.message);

  const payload = await buildNfcePayloadForOrder(
    order.client_id,
    { ...fiscal, state_uf: fiscal.state_uf ?? "SP", tax_regime: fiscal.tax_regime ?? "simples" },
    { value_cents: order.value_cents, metadata, channel: order.channel },
    focusNfe.env,
    {
      csc_id: nfceSettings?.csc_id ?? fiscal.nfce_csc_id,
      csc_token: nfceSettings?.csc_token ?? fiscal.nfce_csc_token,
      presenca_default: nfceSettings?.presenca_default ?? "1",
    },
    series,
  );

  try {
    const emitFn = focusNfe.asyncEmission ? emitNFCe : emitNFCeWithRetry;
    const result = await emitFn(ref, payload, focusNfe.token);

    if (result.status === "processando_autorizacao" && focusNfe.asyncEmission) {
      await supabaseAdmin
        .from("nfe_emissions")
        .update({ status: "pendente", updated_at: new Date().toISOString() })
        .eq("id", emission.id);
      return emission.id;
    }

    const storagePath = result.caminho_xml_nota_fiscal
      ? await uploadNfeXmlToStorage(order.client_id, ref, result.caminho_xml_nota_fiscal)
      : null;
    const xmlSigned = storagePath ? await createNfeXmlSignedUrl(storagePath) : null;
    const qrUrl = result.caminho_danfe ?? null;

    await supabaseAdmin
      .from("nfe_emissions")
      .update({
        status: "autorizada",
        access_key: result.chave_nfe ?? null,
        xml_url: xmlSigned ?? result.caminho_xml_nota_fiscal ?? null,
        xml_storage_path: storagePath,
        danfe_url: qrUrl,
        authorized_at: new Date().toISOString(),
        metadata: { qr_code_url: qrUrl },
        updated_at: new Date().toISOString(),
      })
      .eq("id", emission.id);

    await supabaseAdmin
      .from("orders")
      .update({ nf_status: "autorizada", status: "separacao", updated_at: new Date().toISOString() })
      .eq("id", order.id);

    await emitDomainEvent("nfe.authorized", {
      orderId: order.id,
      clientId: order.client_id,
      danfeUrl: qrUrl,
      xmlUrl: xmlSigned ?? result.caminho_xml_nota_fiscal ?? null,
    });

    await logAudit({
      client_id: order.client_id,
      action: "nfce_emit",
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
