import { sendEmail } from "@/integrations/resend";
import { buildTemplateContext, renderTemplate } from "../template-engine.server";
import { pickRfmEmailBody } from "../rfm-template.server";
import type { SendContext, SendResult } from "./types";

const SUBJECTS: Record<string, string> = {
  default: "Mensagem de {{loja}}",
  pedido_entregue: "Seu pedido foi entregue — {{loja}}",
  pedido_despachado: "Pedido despachado — {{loja}}",
  nfe_confirmacao: "NF-e emitida — pedido {{pedido_id}}",
  carrinho_abandonado: "Você esqueceu algo no carrinho",
  reativacao: "Sentimos sua falta, {{nome}}!",
  upsell_7d: "Sugestão especial para você",
};

const BODIES: Record<string, string> = {
  default: "<p>Olá {{nome}},</p><p>Mensagem de {{loja}}.</p>",
  pedido_entregue:
    "<p>Olá {{nome}},</p><p>Seu pedido foi entregue! Obrigado por comprar na {{loja}}.</p>",
  pedido_despachado:
    "<p>Olá {{nome}},</p><p>Seu pedido {{produto}} foi despachado. Rastreio: {{rastreio}}</p>",
  nfe_confirmacao:
    "<p>Olá {{nome}},</p><p>Sua NF-e foi emitida. Pedido {{pedido_id}}. <a href=\"{{danfe_url}}\">Ver DANFE</a></p>",
  carrinho_abandonado:
    "<p>Olá {{nome}},</p><p>Seus itens ainda estão no carrinho. <a href=\"{{checkout_url}}\">Finalizar compra</a></p>",
  reativacao: "<p>Olá {{nome}},</p><p>Volte para a {{loja}} com uma oferta especial!</p>",
  upsell_7d:
    "<p>Olá {{nome}},</p><p>Baseado na sua compra de {{produto}}, separamos algo especial para você.</p>",
};

export async function sendEmailStep(ctx: SendContext): Promise<SendResult> {
  if (!ctx.email) return { success: false, error: "no_email" };

  const rfmSegment = ctx.enrollmentContext.rfm_segment as string | undefined;
  const tplCtx = buildTemplateContext({
    customerName: ctx.enrollmentContext.customer_name as string | undefined,
    storeName: ctx.storeName,
    productName: ctx.enrollmentContext.product_name as string | undefined,
    valueCents: ctx.enrollmentContext.value_cents as number | undefined,
    trackingCode: ctx.enrollmentContext.tracking_code as string | undefined,
    checkoutUrl: ctx.enrollmentContext.checkout_url as string | undefined,
    orderId: ctx.enrollmentContext.order_id as string | undefined,
    danfeUrl: ctx.enrollmentContext.danfe_url as string | undefined,
    couponCode: ctx.enrollmentContext.coupon_code as string | undefined,
    rfmSegment,
  });

  const subjectTpl = ctx.subject ?? SUBJECTS[ctx.templateKey] ?? SUBJECTS.default;
  const defaultBody = BODIES[ctx.templateKey] ?? BODIES.default;
  const bodyTpl =
    ctx.bodyHtml ?? pickRfmEmailBody(ctx.templateKey, rfmSegment, defaultBody);

  try {
    const result = await sendEmail({
      to: ctx.email,
      subject: renderTemplate(subjectTpl, tplCtx),
      html: renderTemplate(bodyTpl, tplCtx),
      clientId: ctx.clientId,
    });
    return { success: true, providerMessageId: result.id };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
