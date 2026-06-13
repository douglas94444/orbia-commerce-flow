import { getServerConfig } from "@/lib/config.server";
import { cancelNFe, emitNFeWithRetry } from "@/integrations/focus-nfe";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logAudit, logJob, startTimer } from "@/shared/lib/logger";
import { emitDomainEvent } from "@/shared/lib/domain-events.server";
import type { NormalizedOrderItem } from "@/modules/logistics/order-ingestion.server";
import {
  applyDestinatarioToPayload,
  buildNfeItemsFromOrder,
  extractShippingFromMetadata,
} from "./nfe-destinatario.server";
import { uploadNfeXmlToStorage } from "./nfe-storage.server";
import type { FocusNfePayload } from "@/integrations/focus-nfe";

const CANCEL_WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_RETRIES = 3;

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

async function finalizeAuthorizedEmission(
  emissionId: string,
  orderId: string,
  clientId: string,
  ref: string,
  result: {
    chave_nfe?: string;
    caminho_xml_nota_fiscal?: string;
    caminho_danfe?: string;
    status: string;
  },
): Promise<void> {
  let xmlUrl = result.caminho_xml_nota_fiscal ?? null;
  const storedXml = xmlUrl ? await uploadNfeXmlToStorage(clientId, ref, xmlUrl) : null;
  if (storedXml) xmlUrl = storedXml;

  await supabaseAdmin
    .from("nfe_emissions")
    .update({
      status: "autorizada",
      access_key: result.chave_nfe ?? null,
      xml_url: xmlUrl,
      danfe_url: result.caminho_danfe ?? null,
      authorized_at: new Date().toISOString(),
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", emissionId);

  await supabaseAdmin
    .from("orders")
    .update({
      nf_status: "autorizada",
      status: "separacao",
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);

  await supabaseAdmin.from("order_events").insert({
    order_id: orderId,
    status: "separacao",
    source: "fiscal",
    metadata: { nfe_ref: ref, chave: result.chave_nfe },
  });

  await emitDomainEvent("nfe.authorized", {
    orderId,
    clientId,
    danfeUrl: result.caminho_danfe ?? null,
    xmlUrl,
  });
}

export async function retryNfeEmission(emissionId: string): Promise<void> {
  const { focusNfe } = getServerConfig();
  if (!focusNfe.token) throw new Error("FOCUS_NFE_TOKEN não configurado");

  const { data: emission, error } = await supabaseAdmin
    .from("nfe_emissions")
    .select("id, client_id, order_id, external_ref, status, retries, type")
    .eq("id", emissionId)
    .single();

  if (error || !emission) throw new Error("Emissão não encontrada");
  if (!emission.order_id) throw new Error("Emissão sem pedido vinculado");
  if (emission.status === "autorizada") throw new Error("NF já autorizada");
  if (emission.status === "cancelada") throw new Error("NF cancelada — não pode reemitir");
  if ((emission.retries ?? 0) >= MAX_RETRIES) {
    throw new Error("Limite de tentativas atingido (3)");
  }

  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("id, client_id, external_id, value_cents, metadata")
    .eq("id", emission.order_id)
    .single();

  if (!order) throw new Error("Pedido não encontrado");

  const { data: fiscal } = await supabaseAdmin
    .from("fiscal_configs")
    .select("cnpj, company_name, cert_path, default_cfop, default_cst, default_ncm")
    .eq("client_id", order.client_id)
    .maybeSingle();

  if (!fiscal) throw new Error("Configuração fiscal não encontrada");

  const ref =
    emission.external_ref ??
    `orbia-${order.client_id.slice(0, 8)}-${order.external_id}`.replace(/[^a-zA-Z0-9-]/g, "-");

  const nextRetries = (emission.retries ?? 0) + 1;

  await supabaseAdmin
    .from("nfe_emissions")
    .update({
      status: "pendente",
      retries: nextRetries,
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", emissionId);

  const metadata = (order.metadata ?? {}) as Record<string, unknown>;
  const payload = buildNfePayload(fiscal, { value_cents: order.value_cents, metadata }, focusNfe.env);

  try {
    const result = await emitNFeWithRetry(ref, payload, focusNfe.token);
    await finalizeAuthorizedEmission(emissionId, order.id, order.client_id, ref, result);

    await logAudit({
      client_id: order.client_id,
      action: "nfe_retry",
      resource: "nfe_emission",
      resource_id: emissionId,
      new_data: { ref, retries: nextRetries },
    });
  } catch (err) {
    await supabaseAdmin
      .from("nfe_emissions")
      .update({
        status: "rejeitada",
        last_error: (err as Error).message,
        retries: nextRetries,
        updated_at: new Date().toISOString(),
      })
      .eq("id", emissionId);
    throw err;
  }
}

export async function cancelNfeEmission(
  emissionId: string,
  justificativa: string,
): Promise<void> {
  const { focusNfe } = getServerConfig();
  if (!focusNfe.token) throw new Error("FOCUS_NFE_TOKEN não configurado");
  if (justificativa.trim().length < 15) {
    throw new Error("Justificativa deve ter entre 15 e 255 caracteres");
  }

  const { data: emission, error } = await supabaseAdmin
    .from("nfe_emissions")
    .select("id, client_id, order_id, external_ref, status, authorized_at")
    .eq("id", emissionId)
    .single();

  if (error || !emission) throw new Error("Emissão não encontrada");
  if (emission.status !== "autorizada") throw new Error("Somente NF autorizada pode ser cancelada");
  if (!emission.external_ref) throw new Error("Referência Focus NFe ausente");

  const authorizedAt = emission.authorized_at ? new Date(emission.authorized_at).getTime() : 0;
  if (!authorizedAt || Date.now() - authorizedAt > CANCEL_WINDOW_MS) {
    throw new Error("Prazo de 24h para cancelamento expirado — emita NF de devolução");
  }

  await cancelNFe(emission.external_ref, justificativa.trim(), focusNfe.token);

  await supabaseAdmin
    .from("nfe_emissions")
    .update({
      status: "cancelada",
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", emissionId);

  if (emission.order_id) {
    await supabaseAdmin
      .from("orders")
      .update({
        nf_status: "pendente",
        status: "aguardando_nf",
        updated_at: new Date().toISOString(),
      })
      .eq("id", emission.order_id);
  }

  await logAudit({
    client_id: emission.client_id,
    action: "nfe_cancel",
    resource: "nfe_emission",
    resource_id: emissionId,
    new_data: { justificativa: justificativa.trim() },
  });
}

export async function reprocessRejectedNfes(): Promise<{ retried: number; failed: number }> {
  const end = startTimer();
  let retried = 0;
  let failed = 0;

  const { data: rows } = await supabaseAdmin
    .from("nfe_emissions")
    .select("id")
    .eq("status", "rejeitada")
    .lt("retries", MAX_RETRIES)
    .not("order_id", "is", null)
    .order("updated_at", { ascending: true })
    .limit(20);

  for (const row of rows ?? []) {
    try {
      await retryNfeEmission(row.id);
      retried += 1;
    } catch {
      failed += 1;
    }
  }

  await logJob({
    job_type: "retry-fiscal-nfe",
    job_id: `retry-fiscal-${Date.now()}`,
    status: "completed",
    duration_ms: end(),
    metadata: { retried, failed },
  });

  return { retried, failed };
}

export function canCancelWithinWindow(authorizedAt: string | null): boolean {
  if (!authorizedAt) return false;
  return Date.now() - new Date(authorizedAt).getTime() <= CANCEL_WINDOW_MS;
}

export { buildNfePayload, finalizeAuthorizedEmission, MAX_RETRIES };
