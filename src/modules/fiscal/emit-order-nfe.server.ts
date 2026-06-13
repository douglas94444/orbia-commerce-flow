import { getServerConfig } from "@/lib/config.server";
import { emitNFeWithRetry } from "@/integrations/focus-nfe";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logAudit } from "@/shared/lib/logger";
import { emitDomainEvent } from "@/shared/lib/domain-events.server";
import { createNfeXmlSignedUrl, uploadNfeXmlToStorage } from "./nfe-storage.server";
import { buildNfePayloadForOrder } from "./nfe-payload.server";
import { validateFiscalReadiness } from "./fiscal-readiness.server";
import { loadProductFiscalBySkus } from "./product-fiscal.server";
import {
  findActiveNfeEmissionForOrder,
  markOrderNfRejected,
  resolveOrCreateNfeEmission,
} from "./nfe-idempotency.server";
import { validateProductFiscalForEmission } from "./product-fiscal-emission-validation.server";
import type { NormalizedOrderItem } from "@/modules/logistics/order-ingestion.server";

export async function emitNfeForOrder(orderId: string): Promise<void> {
  const { focusNfe } = getServerConfig();
  if (!focusNfe.token) {
    console.warn("[fiscal] FOCUS_NFE_TOKEN not set — skipping emission");
    return;
  }

  const { data: order, error: orderError } = await supabaseAdmin
    .from("orders")
    .select("id, client_id, external_id, value_cents, nf_status, status, metadata, channel")
    .eq("id", orderId)
    .single();

  if (orderError || !order) throw new Error(`Order ${orderId} not found`);
  if (order.nf_status === "autorizada") return;

  const existing = await findActiveNfeEmissionForOrder(orderId);
  if (existing?.status === "autorizada") return;

  const readiness = await validateFiscalReadiness(order.client_id, { attemptFocusSync: true });
  if (!readiness.ready) {
    const missing = readiness.items
      .filter((i) => i.status === "error")
      .map((i) => i.label)
      .join(", ");
    const msg = `Configuração fiscal incompleta: ${missing}. Ajuste em /fiscal/config`;
    await markOrderNfRejected(orderId, msg);
    throw new Error(msg);
  }

  const { data: fiscal, error: fiscalError } = await supabaseAdmin
    .from("fiscal_configs")
    .select(
      "cnpj, company_name, default_cfop, default_cst, default_ncm, state_uf, state_registration, tax_regime",
    )
    .eq("client_id", order.client_id)
    .maybeSingle();

  if (fiscalError || !fiscal) {
    const msg = "Fiscal config not found for client — configure em /fiscal/config";
    await markOrderNfRejected(orderId, msg);
    throw new Error(msg);
  }

  const metadata = (order.metadata ?? {}) as Record<string, unknown>;
  const orderItems = (metadata.items ?? []) as NormalizedOrderItem[];

  const productValidation = await validateProductFiscalForEmission(
    order.client_id,
    orderItems,
    fiscal.default_ncm,
    fiscal.tax_regime as string,
  );
  if (!productValidation.ok) {
    await markOrderNfRejected(orderId, productValidation.message);
    throw new Error(productValidation.message);
  }

  const ref = `orbia-${order.client_id.slice(0, 8)}-${order.external_id}`.replace(
    /[^a-zA-Z0-9-]/g,
    "-",
  );

  const emission = await resolveOrCreateNfeEmission({
    clientId: order.client_id,
    orderId: order.id,
    externalRef: ref,
    valueCents: order.value_cents,
  });

  if (!emission.isNew && existing?.status === "pendente") {
    return;
  }

  const emitRef = emission.externalRef;

  let payload;
  try {
    payload = await buildNfePayloadForOrder(
      order.client_id,
      {
        ...fiscal,
        state_uf: fiscal.state_uf ?? "SP",
        tax_regime: fiscal.tax_regime ?? "simples",
      },
      { value_cents: order.value_cents, metadata, channel: order.channel },
      focusNfe.env,
    );
  } catch (err) {
    const msg = (err as Error).message;
    await supabaseAdmin
      .from("nfe_emissions")
      .update({ status: "rejeitada", last_error: msg, retries: 1, updated_at: new Date().toISOString() })
      .eq("id", emission.id);
    await markOrderNfRejected(orderId, msg);
    throw err;
  }

  try {
    const result = await emitNFeWithRetry(emitRef, payload, focusNfe.token);

    const storagePath = result.caminho_xml_nota_fiscal
      ? await uploadNfeXmlToStorage(order.client_id, emitRef, result.caminho_xml_nota_fiscal)
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
      metadata: { nfe_ref: emitRef, chave: result.chave_nfe },
    });

    await logAudit({
      client_id: order.client_id,
      action: "nfe_emit",
      resource: "nfe_emission",
      resource_id: emission.id,
      new_data: { ref: emitRef, status: result.status },
    });

    await emitDomainEvent("nfe.authorized", {
      orderId: order.id,
      clientId: order.client_id,
      danfeUrl: result.caminho_danfe ?? null,
      xmlUrl: xmlSigned ?? result.caminho_xml_nota_fiscal ?? null,
    });
  } catch (err) {
    const msg = (err as Error).message;
    await supabaseAdmin
      .from("nfe_emissions")
      .update({
        status: "rejeitada",
        last_error: msg,
        retries: 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", emission.id);
    await markOrderNfRejected(orderId, msg);
    throw err;
  }
}
