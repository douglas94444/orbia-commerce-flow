import { getServerConfig } from "@/lib/config.server";
import { emitNFCeWithRetry, emitNFSeWithRetry, type FocusNfsePayload } from "@/integrations/focus-nfe";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logAudit } from "@/shared/lib/logger";
import { uploadNfeXmlToStorage } from "./nfe-storage.server";
import { buildNfePayloadForOrder } from "./nfe-payload.server";
import { extractShippingFromMetadata } from "./nfe-destinatario.server";

export async function emitNfceForOrder(orderId: string): Promise<string> {
  const { focusNfe } = getServerConfig();
  if (!focusNfe.token) throw new Error("FOCUS_NFE_TOKEN não configurado");

  const { data: order, error: orderError } = await supabaseAdmin
    .from("orders")
    .select("id, client_id, external_id, value_cents, metadata")
    .eq("id", orderId)
    .single();

  if (orderError || !order) throw new Error(`Pedido ${orderId} não encontrado`);

  const { data: fiscal } = await supabaseAdmin
    .from("fiscal_configs")
    .select(
      "cnpj, company_name, default_cfop, default_cst, default_ncm, state_uf, state_registration, tax_regime",
    )
    .eq("client_id", order.client_id)
    .maybeSingle();

  if (!fiscal) throw new Error("Configuração fiscal não encontrada");

  const ref = `orbia-nfce-${order.client_id.slice(0, 8)}-${order.external_id}`.replace(
    /[^a-zA-Z0-9-]/g,
    "-",
  );

  const metadata = (order.metadata ?? {}) as Record<string, unknown>;
  const nfePayload = await buildNfePayloadForOrder(
    order.client_id,
    { ...fiscal, state_uf: fiscal.state_uf ?? "SP", tax_regime: fiscal.tax_regime ?? "simples" },
    { value_cents: order.value_cents, metadata },
    focusNfe.env,
  );

  const payload = {
    ...nfePayload,
    presenca_comprador: "1",
    indicador_intermediador: "0",
  };

  const { data: emission, error: insertError } = await supabaseAdmin
    .from("nfe_emissions")
    .insert({
      client_id: order.client_id,
      order_id: order.id,
      external_ref: ref,
      type: "NFC-e",
      status: "pendente",
      value_cents: order.value_cents,
    })
    .select("id")
    .single();

  if (insertError) throw new Error(insertError.message);

  try {
    const result = await emitNFCeWithRetry(ref, payload, focusNfe.token);
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

  const { data: fiscal } = await supabaseAdmin
    .from("fiscal_configs")
    .select(
      "cnpj, company_name, state_uf, state_registration, municipal_registration, municipality_code",
    )
    .eq("client_id", order.client_id)
    .maybeSingle();

  if (!fiscal) throw new Error("Configuração fiscal não encontrada");

  const metadata = (order.metadata ?? {}) as Record<string, unknown>;
  const shipping = extractShippingFromMetadata(metadata);
  const today = new Date().toISOString().slice(0, 10);
  const ref = `orbia-nfse-${order.client_id.slice(0, 8)}-${order.external_id}`.replace(
    /[^a-zA-Z0-9-]/g,
    "-",
  );

  const payload: FocusNfsePayload = {
    data_emissao: today,
    natureza_operacao: "Prestação de serviço",
    prestador: {
      cnpj: fiscal.cnpj.replace(/\D/g, ""),
      inscricao_municipal: fiscal.municipal_registration ?? undefined,
      codigo_municipio: fiscal.municipality_code ?? undefined,
    },
    tomador: {
      razao_social: shipping.name ?? "Consumidor Final",
      cpf: focusNfe.env !== "producao" ? "00000000191" : undefined,
      endereco: {
        logradouro: shipping.street ?? "Rua Teste",
        numero: shipping.number ?? "100",
        bairro: shipping.neighborhood ?? "Centro",
        uf: (shipping.state ?? fiscal.state_uf ?? "SP").slice(0, 2).toUpperCase(),
        cep: (shipping.postalCode ?? "01310100").replace(/\D/g, "").slice(0, 8),
      },
    },
    servico: {
      valor_servicos: order.value_cents / 100,
      item_lista_servico: "01.01",
      discriminacao: serviceDescription ?? "Prestação de serviços conforme pedido",
      codigo_municipio: fiscal.municipality_code ?? undefined,
    },
  };

  const { data: emission, error: insertError } = await supabaseAdmin
    .from("nfe_emissions")
    .insert({
      client_id: order.client_id,
      order_id: order.id,
      external_ref: ref,
      type: "NFS-e",
      status: "pendente",
      value_cents: order.value_cents,
    })
    .select("id")
    .single();

  if (insertError) throw new Error(insertError.message);

  try {
    const result = await emitNFSeWithRetry(ref, payload, focusNfe.token);
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
