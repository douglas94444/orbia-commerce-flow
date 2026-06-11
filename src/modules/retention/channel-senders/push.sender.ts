import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendPushNotification } from "@/integrations/fcm/client";
import { buildTemplateContext, renderTemplate } from "../template-engine.server";
import type { SendContext, SendResult } from "./types";

const PUSH_BODIES: Record<string, string> = {
  default: "Novidade da {{loja}} para você, {{nome}}!",
  pedido_despachado: "Seu pedido foi despachado. Rastreio: {{rastreio}}",
  estoque_favorito: "{{produto}} voltou ao estoque!",
};

export async function sendPushStep(ctx: SendContext): Promise<SendResult> {
  if (!ctx.customerId) return { success: false, error: "no_customer" };

  const { data: tokens } = await supabaseAdmin
    .from("device_tokens")
    .select("token")
    .eq("customer_id", ctx.customerId)
    .eq("is_active", true)
    .limit(5);

  if (!tokens?.length) return { success: false, error: "no_push_tokens" };

  const tplCtx = buildTemplateContext({
    customerName: ctx.enrollmentContext.customer_name as string | undefined,
    storeName: ctx.storeName,
    productName: ctx.enrollmentContext.product_name as string | undefined,
    trackingCode: ctx.enrollmentContext.tracking_code as string | undefined,
  });

  const bodyTpl = ctx.bodyText ?? PUSH_BODIES[ctx.templateKey] ?? PUSH_BODIES.default;
  const title = ctx.subject ?? ctx.storeName;
  const body = renderTemplate(bodyTpl, tplCtx);

  let lastId = "";
  for (const row of tokens) {
    try {
      const result = await sendPushNotification({
        token: row.token,
        title,
        body,
        clientId: ctx.clientId,
      });
      lastId = result.messageId;
    } catch {
      // try next token
    }
  }

  return lastId ? { success: true, providerMessageId: lastId } : { success: false, error: "push_failed" };
}
