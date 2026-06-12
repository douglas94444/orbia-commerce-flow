import { sendSms } from "@/integrations/twilio/client";
import { buildTemplateContext, renderTemplate } from "../template-engine.server";
import { pickRfmSmsBody } from "../rfm-template.server";
import type { SendContext, SendResult } from "./types";

const SMS_BODIES: Record<string, string> = {
  default: "{{loja}}: Oi {{nome}}, temos uma novidade para você.",
  carrinho_abandonado: "{{loja}}: {{nome}}, seu carrinho espera! {{checkout_url}}",
  reativacao: "{{loja}}: Sentimos sua falta {{nome}}! Volte com desconto especial.",
  boleto_lembrete: "{{loja}}: Lembrete: seu boleto vence em breve. Pague em {{checkout_url}}",
};

export async function sendSmsStep(ctx: SendContext): Promise<SendResult> {
  if (!ctx.phone) return { success: false, error: "no_phone" };

  const rfmSegment = ctx.enrollmentContext.rfm_segment as string | undefined;
  const tplCtx = buildTemplateContext({
    customerName: ctx.enrollmentContext.customer_name as string | undefined,
    storeName: ctx.storeName,
    checkoutUrl: ctx.enrollmentContext.checkout_url as string | undefined,
    trackingCode: ctx.enrollmentContext.tracking_code as string | undefined,
    couponCode: ctx.enrollmentContext.coupon_code as string | undefined,
    rfmSegment,
  });

  const defaultBody = SMS_BODIES[ctx.templateKey] ?? SMS_BODIES.default;
  const bodyTpl = ctx.bodyText ?? pickRfmSmsBody(ctx.templateKey, rfmSegment, defaultBody);

  try {
    const result = await sendSms({
      to: ctx.phone,
      body: renderTemplate(bodyTpl, tplCtx),
      clientId: ctx.clientId,
    });
    return { success: true, providerMessageId: result.sid };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
