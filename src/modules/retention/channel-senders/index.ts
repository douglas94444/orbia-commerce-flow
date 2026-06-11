import { sendEmailStep } from "./email.sender";
import { sendPushStep } from "./push.sender";
import { sendSmsStep } from "./sms.sender";
import { sendWhatsAppStep } from "./whatsapp.sender";
import type { SendContext, SendResult } from "./types";

export type { SendContext, SendResult };

export async function sendChannelMessage(
  channel: string,
  ctx: SendContext,
): Promise<SendResult> {
  switch (channel) {
    case "email":
      return sendEmailStep(ctx);
    case "whatsapp":
      return sendWhatsAppStep(ctx);
    case "sms":
      return sendSmsStep(ctx);
    case "push":
      return sendPushStep(ctx);
    default:
      return { success: false, error: `unknown_channel:${channel}` };
  }
}
