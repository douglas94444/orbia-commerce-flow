import { createHmac, timingSafeEqual } from "node:crypto";
import { getServerConfig } from "@/lib/config.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logIntegration, logJob, startTimer } from "@/shared/lib/logger";
import { emitDomainEvent } from "@/shared/lib/domain-events.server";
import { createNfeXmlSignedUrl, uploadNfeXmlToStorage } from "./nfe-storage.server";

export interface FocusWebhookPayload {
  ref?: string;
  status?: string;
  status_sefaz?: string;
  mensagem_sefaz?: string;
  chave_nfe?: string;
  caminho_xml_nota_fiscal?: string;
  caminho_danfe?: string;
  cnpj_emitente?: string;
  erros?: Array<{ mensagem: string }>;
}

function validateFocusSignature(rawBody: string, signature: string | null): boolean {
  const { focusNfe } = getServerConfig();
  const secret = focusNfe.webhookSecret;
  if (!secret || !signature) return !secret;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

export async function saveFocusWebhookEvent(
  eventId: string,
  eventType: string,
  payload: FocusWebhookPayload,
  clientId?: string | null,
): Promise<{ queued: boolean; id: string }> {
  const { data, error } = await supabaseAdmin
    .from("fiscal_webhook_events")
    .insert({
      provider: "focus_nfe",
      event_id: eventId,
      event_type: eventType,
      client_id: clientId ?? null,
      payload: payload as Record<string, unknown>,
      status: "queued",
    })
    .select("id")
    .single();

  if (error?.code === "23505") {
    const { data: existing } = await supabaseAdmin
      .from("fiscal_webhook_events")
      .select("id")
      .eq("provider", "focus_nfe")
      .eq("event_id", eventId)
      .single();
    return { queued: false, id: existing?.id ?? "" };
  }
  if (error) throw new Error(error.message);
  return { queued: true, id: data.id };
}

async function finalizeFromWebhook(
  emissionId: string,
  orderId: string | null,
  clientId: string,
  ref: string,
  result: FocusWebhookPayload,
): Promise<void> {
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
      webhook_received_at: new Date().toISOString(),
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", emissionId);

  if (orderId) {
    await supabaseAdmin
      .from("orders")
      .update({ nf_status: "autorizada", status: "separacao", updated_at: new Date().toISOString() })
      .eq("id", orderId);

    await supabaseAdmin.from("order_events").insert({
      order_id: orderId,
      status: "separacao",
      source: "fiscal",
      metadata: { nfe_ref: ref, chave: result.chave_nfe, via: "webhook" },
    });

    await emitDomainEvent("nfe.authorized", {
      orderId,
      clientId,
      danfeUrl: result.caminho_danfe ?? null,
      xmlUrl: xmlSigned ?? result.caminho_xml_nota_fiscal ?? null,
    });
  }
}

export async function processFocusWebhookEvent(eventRowId: string): Promise<void> {
  const end = startTimer();
  const { data: event, error } = await supabaseAdmin
    .from("fiscal_webhook_events")
    .select("*")
    .eq("id", eventRowId)
    .single();

  if (error || !event) throw new Error("Webhook event not found");
  if (event.status === "processed") return;

  const payload = event.payload as FocusWebhookPayload;
  const ref = payload.ref;
  if (!ref) throw new Error("Missing ref in Focus webhook");

  const { data: emission } = await supabaseAdmin
    .from("nfe_emissions")
    .select("id, client_id, order_id, status, external_ref")
    .eq("external_ref", ref)
    .maybeSingle();

  if (!emission) {
    await supabaseAdmin
      .from("fiscal_webhook_events")
      .update({ status: "failed", attempts: event.attempts + 1 })
      .eq("id", eventRowId);
    return;
  }

  const status = (payload.status ?? "").toLowerCase();

  if (status === "autorizado" || status === "autorizada") {
    await finalizeFromWebhook(
      emission.id,
      emission.order_id,
      emission.client_id,
      emission.external_ref ?? ref,
      payload,
    );
    await supabaseAdmin
      .from("fiscal_webhook_events")
      .update({ status: "processed", processed_at: new Date().toISOString(), client_id: emission.client_id })
      .eq("id", eventRowId);

    await logIntegration({
      client_id: emission.client_id,
      provider: "focus_nfe",
      operation: "webhook_authorized",
      status: "success",
      duration_ms: end(),
    });
    return;
  }

  if (status === "erro_autorizacao" || status === "denegado" || status === "rejeitada") {
    const msg =
      payload.mensagem_sefaz ??
      payload.erros?.map((e) => e.mensagem).join("; ") ??
      "Rejeitada pela SEFAZ";

    await supabaseAdmin
      .from("nfe_emissions")
      .update({
        status: "rejeitada",
        last_error: msg,
        webhook_received_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", emission.id);

    if (emission.order_id) {
      await supabaseAdmin
        .from("orders")
        .update({ nf_status: "rejeitada", updated_at: new Date().toISOString() })
        .eq("id", emission.order_id);
    }

    await supabaseAdmin
      .from("fiscal_webhook_events")
      .update({ status: "processed", processed_at: new Date().toISOString(), client_id: emission.client_id })
      .eq("id", eventRowId);
  }
}

export async function handleFocusWebhook(
  rawBody: string,
  signature: string | null,
  payload: FocusWebhookPayload,
): Promise<void> {
  if (!validateFocusSignature(rawBody, signature)) {
    throw new Error("Invalid Focus webhook signature");
  }

  const eventId = `${payload.ref ?? "unknown"}-${payload.status ?? Date.now()}`;
  const { queued, id } = await saveFocusWebhookEvent(
    eventId,
    payload.status ?? "unknown",
    payload,
  );

  if (queued && id) {
    processFocusWebhookEvent(id).catch((err) => {
      console.error("[fiscal/focus-webhook] async process:", err);
    });
  }
}

export async function reconcilePendingWebhookEmissions(): Promise<number> {
  const cutoff = new Date(Date.now() - 5 * 60_000).toISOString();
  const { data: pending } = await supabaseAdmin
    .from("nfe_emissions")
    .select("id, external_ref, client_id")
    .eq("status", "pendente")
    .lt("created_at", cutoff)
    .not("external_ref", "is", null)
    .limit(30);

  let reconciled = 0;
  for (const e of pending ?? []) {
    const { data: wh } = await supabaseAdmin
      .from("fiscal_webhook_events")
      .select("id")
      .contains("payload", { ref: e.external_ref })
      .eq("status", "queued")
      .limit(1)
      .maybeSingle();

    if (wh?.id) {
      await processFocusWebhookEvent(wh.id);
      reconciled++;
    }
  }

  await logJob({
    job_type: "fiscal-webhook-reconcile",
    job_id: `reconcile-${Date.now()}`,
    status: "completed",
    metadata: { reconciled },
  });

  return reconciled;
}
