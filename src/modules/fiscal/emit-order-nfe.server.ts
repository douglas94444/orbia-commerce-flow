import { getServerConfig } from "@/lib/config.server";
import { emitNFeWithRetry } from "@/integrations/focus-nfe";
import type { FocusNfeItem, FocusNfePayload } from "@/integrations/focus-nfe";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logAudit } from "@/shared/lib/logger";
import type { NormalizedOrderItem } from "@/modules/logistics/order-ingestion.server";

function buildNfePayload(
  fiscal: {
    cnpj: string;
    company_name: string;
    default_cfop: string | null;
    default_cst: string | null;
    default_ncm: string | null;
  },
  order: { value_cents: number; metadata: { items?: NormalizedOrderItem[] } },
): FocusNfePayload {
  const today = new Date().toISOString().slice(0, 10);
  const items = order.metadata?.items ?? [];
  const cfop = fiscal.default_cfop ?? "5102";
  const ncm = fiscal.default_ncm ?? "61091000";
  const cst = fiscal.default_cst ?? "102";

  const nfeItems: FocusNfeItem[] = items.length
    ? items.map((item, i) => ({
        numero_item: String(i + 1),
        codigo_produto: item.sku,
        descricao: item.name.slice(0, 120),
        cfop,
        unidade_comercial: "UN",
        quantidade_comercial: item.quantity,
        valor_unitario_comercial: item.unitPriceCents / 100,
        valor_bruto: (item.unitPriceCents * item.quantity) / 100,
        codigo_ncm: item.ncm ?? ncm,
        icms_situacao_tributaria: cst,
        icms_origem: "0",
      }))
    : [
        {
          numero_item: "1",
          codigo_produto: "PROD001",
          descricao: "Venda de mercadoria",
          cfop,
          unidade_comercial: "UN",
          quantidade_comercial: 1,
          valor_unitario_comercial: order.value_cents / 100,
          valor_bruto: order.value_cents / 100,
          codigo_ncm: ncm,
          icms_situacao_tributaria: cst,
          icms_origem: "0",
        },
      ];

  return {
    natureza_operacao: "Venda de mercadoria",
    data_emissao: today,
    tipo_documento: "1",
    local_destino: "1",
    finalidade_emissao: "1",
    consumidor_final: "1",
    presenca_comprador: "2",
    cnpj_emitente: fiscal.cnpj,
    nome_destinatario: "Consumidor Final",
    cpf_destinatario: "00000000191",
    logradouro_destinatario: "Rua Teste",
    numero_destinatario: "100",
    bairro_destinatario: "Centro",
    municipio_destinatario: "Sao Paulo",
    uf_destinatario: "SP",
    cep_destinatario: "01310100",
    items: nfeItems,
  };
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
    .select("cnpj, company_name, default_cfop, default_cst, default_ncm")
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

  const payload = buildNfePayload(fiscal, {
    value_cents: order.value_cents,
    metadata: (order.metadata ?? {}) as { items?: NormalizedOrderItem[] },
  });

  try {
    const result = await emitNFeWithRetry(ref, payload, focusNfe.token);

    await supabaseAdmin
      .from("nfe_emissions")
      .update({
        status: "autorizada",
        access_key: result.chave_nfe ?? null,
        xml_url: result.caminho_xml_nota_fiscal ?? null,
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
