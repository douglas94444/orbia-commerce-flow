import { sendSms } from "@/integrations/twilio/client";
import { buildTemplateContext, renderTemplate } from "../template-engine.server";
import type { SendContext, SendResult } from "./types";

const SMS_BODIES: Record<string, string> = {
  default: "{{loja}}: Oi {{nome}}, temos uma novidade para você.",
  carrinho_abandonado: "{{loja}}: {{nome}}, seu carrinho espera! {{checkout_url}}",
  reativacao: "{{loja}}: Sentimos sua falta {{nome}}! Volte com desconto especial.",
  boleto_lembrete: "{{loja}}: Lembrete: seu boleto vence em breve. Pague em {{checkout_url}}",
};

export async function sendSmsStep(ctx: SendContext): Promise<SendResult> {
  if (!ctx.phone) return { success: false, error: "no_phone" };

  const tplCtx = buildTemplateContext({
    customerName: ctx.enrollmentContext.customer_name as string | undefined,
    storeName: ctx.storeName,
    checkoutUrl: ctx.enrollmentContext.checkout_url as string | undefined,
    trackingCode: ctx.enrollmentContext.tracking_code as string | undefined,
  });

  const bodyTpl = ctx.bodyText ?? SMS_BODIES[ctx.templateKey] ?? SMS_BODIES.default;

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
