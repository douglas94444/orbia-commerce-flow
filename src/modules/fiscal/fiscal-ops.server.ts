import { getServerConfig } from "@/lib/config.server";
import {
  cancelNFe,
  cartaCorrecaoNFe,
  emitNFeWithRetry,
  inutilizarNumeracao,
} from "@/integrations/focus-nfe";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logAudit, logJob, startTimer } from "@/shared/lib/logger";
import { emitDomainEvent } from "@/shared/lib/domain-events.server";
import { createNfeXmlSignedUrl, uploadNfeXmlToStorage } from "./nfe-storage.server";
import { buildNfePayloadForOrder } from "./nfe-payload.server";
import { recordNfeFiscalEvent } from "./nfe-fiscal-events.server";

const CANCEL_WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_RETRIES = 3;

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
  const storagePath = xmlUrl ? await uploadNfeXmlToStorage(clientId, ref, xmlUrl) : null;
  const xmlSigned = storagePath ? await createNfeXmlSignedUrl(storagePath) : null;
  if (xmlSigned) xmlUrl = xmlSigned;

  await supabaseAdmin
    .from("nfe_emissions")
    .update({
      status: "autorizada",
      access_key: result.chave_nfe ?? null,
      xml_url: xmlUrl,
      xml_storage_path: storagePath,
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
    .select("id, client_id, external_id, value_cents, metadata, channel")
    .eq("id", emission.order_id)
    .single();

  if (!order) throw new Error("Pedido não encontrado");

  const { data: fiscal } = await supabaseAdmin
    .from("fiscal_configs")
    .select(
      "cnpj, company_name, default_cfop, default_cst, default_ncm, state_uf, state_registration, tax_regime",
    )
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
  const payload = await buildNfePayloadForOrder(
    order.client_id,
    { ...fiscal, state_uf: fiscal.state_uf ?? "SP", tax_regime: fiscal.tax_regime ?? "simples" },
    { value_cents: order.value_cents, metadata, channel: order.channel },
    focusNfe.env,
  );

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

  await recordNfeFiscalEvent({
    clientId: emission.client_id as string,
    nfeEmissionId: emissionId,
    eventType: "cancelamento",
    description: justificativa.trim(),
    payload: { justificativa: justificativa.trim() },
  });
}

export async function cartaCorrecaoNfeEmission(
  emissionId: string,
  correcao: string,
): Promise<void> {
  const { focusNfe } = getServerConfig();
  if (!focusNfe.token) throw new Error("FOCUS_NFE_TOKEN não configurado");
  if (correcao.trim().length < 15) {
    throw new Error("Correção deve ter entre 15 e 1000 caracteres");
  }

  const { data: emission, error } = await supabaseAdmin
    .from("nfe_emissions")
    .select("id, client_id, external_ref, status, type")
    .eq("id", emissionId)
    .single();

  if (error || !emission) throw new Error("Emissão não encontrada");
  if (emission.status !== "autorizada") throw new Error("Somente NF autorizada aceita CC-e");
  if (emission.type !== "NF-e") throw new Error("CC-e disponível apenas para NF-e");
  if (!emission.external_ref) throw new Error("Referência Focus NFe ausente");

  await cartaCorrecaoNFe(emission.external_ref, correcao.trim(), focusNfe.token);

  await logAudit({
    client_id: emission.client_id,
    action: "nfe_cce",
    resource: "nfe_emission",
    resource_id: emissionId,
    new_data: { correcao: correcao.trim().slice(0, 200) },
  });

  await recordNfeFiscalEvent({
    clientId: emission.client_id as string,
    nfeEmissionId: emissionId,
    eventType: "carta_correcao",
    description: correcao.trim().slice(0, 200),
    payload: { correcao: correcao.trim() },
  });
}

export async function inutilizarNumeracaoFiscal(input: {
  clientId: string;
  serie: string;
  numeroInicial: number;
  numeroFinal: number;
  justificativa: string;
}): Promise<void> {
  const { focusNfe } = getServerConfig();
  if (!focusNfe.token) throw new Error("FOCUS_NFE_TOKEN não configurado");
  if (input.justificativa.trim().length < 15) {
    throw new Error("Justificativa deve ter entre 15 e 255 caracteres");
  }

  const { data: fiscal } = await supabaseAdmin
    .from("fiscal_configs")
    .select("cnpj")
    .eq("client_id", input.clientId)
    .maybeSingle();

  if (!fiscal?.cnpj) throw new Error("Configuração fiscal não encontrada");

  await inutilizarNumeracao(
    {
      cnpj: fiscal.cnpj,
      serie: input.serie,
      numero_inicial: input.numeroInicial,
      numero_final: input.numeroFinal,
      justificativa: input.justificativa.trim(),
    },
    focusNfe.token,
  );

  await logAudit({
    client_id: input.clientId,
    action: "nfe_inutilizacao",
    resource: "fiscal_config",
    new_data: {
      serie: input.serie,
      numero_inicial: input.numeroInicial,
      numero_final: input.numeroFinal,
    },
  });

  await recordNfeFiscalEvent({
    clientId: input.clientId,
    eventType: "inutilizacao",
    description: input.justificativa.trim(),
    payload: {
      serie: input.serie,
      numero_inicial: input.numeroInicial,
      numero_final: input.numeroFinal,
    },
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

export { finalizeAuthorizedEmission, MAX_RETRIES };
