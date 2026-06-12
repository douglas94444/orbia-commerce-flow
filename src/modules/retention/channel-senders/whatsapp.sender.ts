import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendEvolutionDocument, sendEvolutionText } from "@/integrations/evolution/client";
import {
  sendDocumentMessage,
  sendTemplateMessage,
  sendTemplateWithButtons,
  sendTemplateWithImage,
  sendWhatsAppMessage,
} from "@/integrations/whatsapp";
import { getWhatsAppCredentials } from "@/integrations/whatsapp/provider";
import { hashContact } from "../customer-sync.server";
import { buildTemplateContext } from "../template-engine.server";
import type { SendContext, SendResult } from "./types";

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("55")) return digits;
  return `55${digits}`;
}

async function isOptedOut(clientId: string, phone: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("whatsapp_opt_outs")
    .select("id")
    .eq("client_id", clientId)
    .eq("phone_hash", hashContact(phone))
    .maybeSingle();
  return !!data;
}

async function hasOpenSession(customerId: string | null): Promise<boolean> {
  if (!customerId) return false;
  const { data } = await supabaseAdmin
    .from("customer_contact_prefs")
    .select("whatsapp_window_expires_at")
    .eq("customer_id", customerId)
    .maybeSingle();
  if (!data?.whatsapp_window_expires_at) return false;
  return new Date(data.whatsapp_window_expires_at) > new Date();
}

const TEMPLATE_MAP: Record<string, string> = {
  default: "pedido_entregue_obrigado",
  pedido_entregue: "pedido_entregue_obrigado",
  pedido_despachado: "pedido_despachado_rastreio",
  nfe_confirmacao: "nfe_confirmacao_pedido",
  carrinho_abandonado: "carrinho_abandonado",
  reativacao: "reativacao_cliente",
  upsell_7d: "upsell_pos_entrega",
  aniversario: "aniversario_cliente",
  boleto_lembrete: "boleto_lembrete",
  avaliacao_negativa: "recuperacao_avaliacao",
  estoque_favorito: "produto_volta_estoque",
  fidelidade_pontos: "fidelidade_saldo",
};

export async function sendWhatsAppStep(ctx: SendContext): Promise<SendResult> {
  if (!ctx.phone) return { success: false, error: "no_phone" };
  if (await isOptedOut(ctx.clientId, ctx.phone)) return { success: false, error: "opted_out" };

  const creds = await getWhatsAppCredentials(ctx.clientId);
  if (!creds) return { success: false, error: "no_whatsapp_connection" };

  const tplCtx = buildTemplateContext({
    customerName: ctx.enrollmentContext.customer_name as string | undefined,
    storeName: ctx.storeName,
    productName: ctx.enrollmentContext.product_name as string | undefined,
    valueCents: ctx.enrollmentContext.value_cents as number | undefined,
    trackingCode: ctx.enrollmentContext.tracking_code as string | undefined,
    orderId: ctx.enrollmentContext.order_id as string | undefined,
    danfeUrl: ctx.enrollmentContext.danfe_url as string | undefined,
    points: ctx.enrollmentContext.points as number | undefined,
    couponCode: ctx.enrollmentContext.coupon_code as string | undefined,
  });

  const to = normalizePhone(ctx.phone);
  const danfeUrl = ctx.enrollmentContext.danfe_url as string | undefined;
  const sessionOpen = await hasOpenSession(ctx.customerId);

  try {
    if (creds.provider === "evolution") {
      if (danfeUrl && ctx.templateKey === "nfe_confirmacao") {
        const result = await sendEvolutionDocument({
          baseUrl: creds.baseUrl,
          apiKey: creds.apiKey,
          instance: creds.instance,
          to,
          documentUrl: danfeUrl,
          fileName: `DANFE-${ctx.enrollmentContext.order_id ?? "pedido"}.pdf`,
          caption: `Sua NF-e foi emitida — ${ctx.storeName}`,
          clientId: ctx.clientId,
        });
        return { success: true, providerMessageId: result.messageId };
      }

      const body = [
        `Olá ${tplCtx.nome ?? "cliente"}!`,
        tplCtx.produto ? `Produto: ${tplCtx.produto}` : null,
        tplCtx.rastreio ? `Rastreio: ${tplCtx.rastreio}` : null,
        tplCtx.cupom ? `Cupom: ${tplCtx.cupom}` : null,
        tplCtx.danfe_url ? `DANFE: ${tplCtx.danfe_url}` : null,
      ]
        .filter(Boolean)
        .join("\n");

      const result = await sendEvolutionText({
        baseUrl: creds.baseUrl,
        apiKey: creds.apiKey,
        instance: creds.instance,
        to,
        text: body || `Mensagem de ${ctx.storeName}`,
        clientId: ctx.clientId,
      });
      return { success: true, providerMessageId: result.messageId };
    }

    if (danfeUrl && ctx.templateKey === "nfe_confirmacao") {
      const result = await sendDocumentMessage({
        phoneNumberId: creds.phoneNumberId,
        accessToken: creds.accessToken,
        to,
        documentUrl: danfeUrl,
        filename: `DANFE-${ctx.enrollmentContext.order_id ?? "pedido"}.pdf`,
        caption: `NF-e autorizada — ${ctx.storeName}`,
        clientId: ctx.clientId,
      });
      return { success: true, providerMessageId: result.messageId };
    }

    if (sessionOpen && !ctx.metadata.force_template) {
      const body = [
        `Olá ${tplCtx.nome ?? "cliente"}!`,
        tplCtx.produto ? `${tplCtx.produto}` : null,
        tplCtx.rastreio ? `Rastreio: ${tplCtx.rastreio}` : null,
        tplCtx.cupom ? `Use o cupom ${tplCtx.cupom}` : null,
      ]
        .filter(Boolean)
        .join(" — ");

      const result = await sendWhatsAppMessage({
        phoneNumberId: creds.phoneNumberId,
        accessToken: creds.accessToken,
        to,
        body: body || `Atualização do seu pedido — ${ctx.storeName}`,
        clientId: ctx.clientId,
      });
      return { success: true, providerMessageId: result.messageId };
    }

    const meta = ctx.metadata;
    const templateName = String(meta.template_name ?? TEMPLATE_MAP[ctx.templateKey] ?? TEMPLATE_MAP.default);
    const language = String(meta.language ?? "pt_BR");
    const bodyParams = [tplCtx.nome ?? "cliente", tplCtx.loja ?? ctx.storeName];
    if (tplCtx.rastreio) bodyParams.push(tplCtx.rastreio);
    if (tplCtx.produto) bodyParams.push(tplCtx.produto);
    if (tplCtx.cupom) bodyParams.push(tplCtx.cupom);

    const imageUrl = ctx.enrollmentContext.product_image as string | undefined;
    const useButtons = Boolean(meta.use_buttons ?? ctx.templateKey === "pedido_despachado");

    let result: { messageId: string };
    if (imageUrl) {
      result = await sendTemplateWithImage({
        phoneNumberId: creds.phoneNumberId,
        accessToken: creds.accessToken,
        to,
        templateName,
        language,
        imageUrl,
        bodyParams,
        clientId: ctx.clientId,
      });
    } else if (useButtons) {
      result = await sendTemplateWithButtons({
        phoneNumberId: creds.phoneNumberId,
        accessToken: creds.accessToken,
        to,
        templateName,
        language,
        bodyParams,
        buttonParams: ["ver_pedido", "falar_atendimento"],
        clientId: ctx.clientId,
      });
    } else {
      result = await sendTemplateMessage({
        phoneNumberId: creds.phoneNumberId,
        accessToken: creds.accessToken,
        to,
        templateName,
        language,
        bodyParams,
        clientId: ctx.clientId,
      });
    }
    return { success: true, providerMessageId: result.messageId };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
