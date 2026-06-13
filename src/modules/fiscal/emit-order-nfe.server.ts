import { getServerConfig } from "@/lib/config.server";
import { emitNFeWithRetry } from "@/integrations/focus-nfe";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logAudit } from "@/shared/lib/logger";
import { emitDomainEvent } from "@/shared/lib/domain-events.server";
import { uploadNfeXmlToStorage } from "./nfe-storage.server";
import { buildNfePayloadForOrder } from "./nfe-payload.server";
import { validateFiscalReadiness } from "./fiscal-readiness.server";
import { loadProductFiscalBySkus } from "./product-fiscal.server";
import type { NormalizedOrderItem } from "@/modules/logistics/order-ingestion.server";

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

  const readiness = await validateFiscalReadiness(order.client_id, { attemptFocusSync: true });
  if (!readiness.ready) {
    const missing = readiness.items
      .filter((i) => i.status === "error")
      .map((i) => i.label)
      .join(", ");
    throw new Error(`Configuração fiscal incompleta: ${missing}. Ajuste em /fiscal/config`);
  }

  const { data: fiscal, error: fiscalError } = await supabaseAdmin
    .from("fiscal_configs")
    .select(
      "cnpj, company_name, default_cfop, default_cst, default_ncm, state_uf, state_registration, tax_regime",
    )
    .eq("client_id", order.client_id)
    .maybeSingle();

  if (fiscalError || !fiscal) {
    throw new Error("Fiscal config not found for client — configure em /fiscal/config");
  }

  const metadata = (order.metadata ?? {}) as Record<string, unknown>;
  const orderItems = (metadata.items ?? []) as NormalizedOrderItem[];
  if (orderItems.length > 0) {
    const productFiscal = await loadProductFiscalBySkus(
      order.client_id,
      orderItems.map((i) => i.sku).filter(Boolean),
    );
    const missingNcm = orderItems.filter((item) => {
      const pf = productFiscal.get(item.sku);
      const ncm = pf?.ncm ?? item.ncm ?? fiscal.default_ncm;
      return !ncm || !/^\d{8}$/.test(String(ncm).replace(/\D/g, ""));
    });
    if (missingNcm.length > 0) {
      throw new Error(
        `SKUs sem NCM válido: ${missingNcm.map((i) => i.sku).join(", ")}. Configure em /catalog/fiscal`,
      );
    }
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

  const payload = await buildNfePayloadForOrder(
    order.client_id,
    {
      ...fiscal,
      state_uf: fiscal.state_uf ?? "SP",
      tax_regime: fiscal.tax_regime ?? "simples",
    },
    { value_cents: order.value_cents, metadata },
    focusNfe.env,
  );

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
