import { decryptToken } from "@/lib/crypto.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  sendTemplateMessage,
  sendTemplateWithButtons,
  sendTemplateWithImage,
} from "@/integrations/whatsapp";
import { hashContact } from "../customer-sync.server";
import { buildTemplateContext } from "../template-engine.server";
import type { SendContext, SendResult } from "./types";

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("55")) return digits;
  return `55${digits}`;
}

async function getWhatsAppConnection(clientId: string) {
  const { data } = await supabaseAdmin
    .from("oauth_connections")
    .select("access_token, metadata")
    .eq("client_id", clientId)
    .eq("provider", "whatsapp")
    .eq("is_active", true)
    .maybeSingle();

  if (!data?.access_token) return null;
  const meta = (data.metadata ?? {}) as Record<string, unknown>;
  const phoneNumberId = String(meta.phone_number_id ?? "");
  if (!phoneNumberId) return null;
  return { accessToken: decryptToken(data.access_token), phoneNumberId };
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

  const wa = await getWhatsAppConnection(ctx.clientId);
  if (!wa) return { success: false, error: "no_whatsapp_connection" };

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

  const meta = ctx.metadata;
  const templateName = String(meta.template_name ?? TEMPLATE_MAP[ctx.templateKey] ?? TEMPLATE_MAP.default);
  const language = String(meta.language ?? "pt_BR");
  const bodyParams = [tplCtx.nome ?? "cliente", tplCtx.loja ?? ctx.storeName];
  if (tplCtx.rastreio) bodyParams.push(tplCtx.rastreio);
  if (tplCtx.produto) bodyParams.push(tplCtx.produto);

  const to = normalizePhone(ctx.phone);
  const imageUrl = ctx.enrollmentContext.product_image as string | undefined;
  const useButtons = Boolean(meta.use_buttons ?? ctx.templateKey === "pedido_despachado");

  try {
    let result: { messageId: string };
    if (imageUrl) {
      result = await sendTemplateWithImage({
        phoneNumberId: wa.phoneNumberId,
        accessToken: wa.accessToken,
        to,
        templateName,
        language,
        imageUrl,
        bodyParams,
        clientId: ctx.clientId,
      });
    } else if (useButtons) {
      result = await sendTemplateWithButtons({
        phoneNumberId: wa.phoneNumberId,
        accessToken: wa.accessToken,
        to,
        templateName,
        language,
        bodyParams,
        buttonParams: ["ver_pedido", "falar_atendimento"],
        clientId: ctx.clientId,
      });
    } else {
      result = await sendTemplateMessage({
        phoneNumberId: wa.phoneNumberId,
        accessToken: wa.accessToken,
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
