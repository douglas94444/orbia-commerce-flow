import { logIntegration, startTimer } from "@/shared/lib/logger";

const GRAPH_BASE = "https://graph.facebook.com/v21.0";

interface WaResponse {
  messages?: Array<{ id: string }>;
  error?: { message: string };
}

async function postWhatsAppMessage(
  phoneNumberId: string,
  accessToken: string,
  payload: Record<string, unknown>,
  clientId?: string,
): Promise<{ messageId: string }> {
  const end = startTimer();
  const res = await fetch(`${GRAPH_BASE}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  let body: WaResponse = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = {};
  }

  await logIntegration({
    provider: "meta",
    operation: "send_whatsapp",
    status: res.ok ? "success" : "error",
    response_code: res.status,
    duration_ms: end(),
    client_id: clientId,
    error_message: res.ok ? undefined : body.error?.message ?? String(text).slice(0, 500),
  });

  if (!res.ok) throw new Error(body.error?.message ?? `WhatsApp API ${res.status}`);
  return { messageId: body.messages?.[0]?.id ?? "" };
}

export async function sendWhatsAppMessage(input: {
  phoneNumberId: string;
  accessToken: string;
  to: string;
  body: string;
  clientId?: string;
}): Promise<{ messageId: string }> {
  const to = input.to.replace(/\D/g, "");
  return postWhatsAppMessage(
    input.phoneNumberId,
    input.accessToken,
    {
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: input.body },
    },
    input.clientId,
  );
}

/** Convenience wrapper — resolves credentials from env when omitted */
export async function sendWhatsAppMessageSimple(input: {
  to: string;
  body: string;
  clientId?: string;
}): Promise<void> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!phoneNumberId || !accessToken) {
    console.warn("[whatsapp] WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN not set");
    return;
  }
  await sendWhatsAppMessage({
    phoneNumberId,
    accessToken,
    to: input.to,
    body: input.body,
    clientId: input.clientId,
  });
}

export async function sendTemplateMessage(input: {
  phoneNumberId: string;
  accessToken: string;
  to: string;
  templateName: string;
  language: string;
  bodyParams?: string[];
  clientId?: string;
}): Promise<{ messageId: string }> {
  const to = input.to.replace(/\D/g, "");
  const components =
    input.bodyParams?.length ?
      [{ type: "body", parameters: input.bodyParams.map((t) => ({ type: "text", text: t })) }]
    : [];

  return postWhatsAppMessage(
    input.phoneNumberId,
    input.accessToken,
    {
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: input.templateName,
        language: { code: input.language },
        components,
      },
    },
    input.clientId,
  );
}

export async function sendTemplateWithImage(input: {
  phoneNumberId: string;
  accessToken: string;
  to: string;
  templateName: string;
  language: string;
  imageUrl: string;
  bodyParams?: string[];
  clientId?: string;
}): Promise<{ messageId: string }> {
  const to = input.to.replace(/\D/g, "");
  const components: Array<Record<string, unknown>> = [
    {
      type: "header",
      parameters: [{ type: "image", image: { link: input.imageUrl } }],
    },
  ];
  if (input.bodyParams?.length) {
    components.push({
      type: "body",
      parameters: input.bodyParams.map((t) => ({ type: "text", text: t })),
    });
  }

  return postWhatsAppMessage(
    input.phoneNumberId,
    input.accessToken,
    {
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: input.templateName,
        language: { code: input.language },
        components,
      },
    },
    input.clientId,
  );
}

export async function sendDocumentMessage(input: {
  phoneNumberId: string;
  accessToken: string;
  to: string;
  documentUrl: string;
  filename: string;
  caption?: string;
  clientId?: string;
}): Promise<{ messageId: string }> {
  const to = input.to.replace(/\D/g, "");
  return postWhatsAppMessage(
    input.phoneNumberId,
    input.accessToken,
    {
      messaging_product: "whatsapp",
      to,
      type: "document",
      document: {
        link: input.documentUrl,
        filename: input.filename,
        caption: input.caption ?? "",
      },
    },
    input.clientId,
  );
}

export async function sendTemplateWithButtons(input: {
  phoneNumberId: string;
  accessToken: string;
  to: string;
  templateName: string;
  language: string;
  bodyParams?: string[];
  buttonParams?: string[];
  clientId?: string;
}): Promise<{ messageId: string }> {
  const to = input.to.replace(/\D/g, "");
  const components: Array<Record<string, unknown>> = [];
  if (input.bodyParams?.length) {
    components.push({
      type: "body",
      parameters: input.bodyParams.map((t) => ({ type: "text", text: t })),
    });
  }
  if (input.buttonParams?.length) {
    components.push({
      type: "button",
      sub_type: "quick_reply",
      index: "0",
      parameters: input.buttonParams.map((t) => ({ type: "payload", payload: t })),
    });
  }

  return postWhatsAppMessage(
    input.phoneNumberId,
    input.accessToken,
    {
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: input.templateName,
        language: { code: input.language },
        components,
      },
    },
    input.clientId,
  );
}

export async function sendInteractiveListMessage(input: {
  phoneNumberId: string;
  accessToken: string;
  to: string;
  bodyText: string;
  buttonLabel: string;
  sections: Array<{
    title: string;
    rows: Array<{ id: string; title: string; description?: string }>;
  }>;
  clientId?: string;
}): Promise<{ messageId: string }> {
  const to = input.to.replace(/\D/g, "");
  return postWhatsAppMessage(
    input.phoneNumberId,
    input.accessToken,
    {
      messaging_product: "whatsapp",
      to,
      type: "interactive",
      interactive: {
        type: "list",
        body: { text: input.bodyText },
        action: {
          button: input.buttonLabel,
          sections: input.sections,
        },
      },
    },
    input.clientId,
  );
}

export interface InboundWhatsAppMessage {
  from: string;
  messageId: string;
  text: string;
  timestamp: number;
  replyId?: string;
  replyType?: "button_reply" | "list_reply" | "text";
}

export function parseInboundMessages(payload: unknown): InboundWhatsAppMessage[] {
  const body = payload as Record<string, unknown>;
  const entry = (body.entry ?? []) as Array<Record<string, unknown>>;
  const messages: InboundWhatsAppMessage[] = [];

  for (const e of entry) {
    const changes = (e.changes ?? []) as Array<Record<string, unknown>>;
    for (const change of changes) {
      const value = change.value as Record<string, unknown> | undefined;
      const msgs = (value?.messages ?? []) as Array<Record<string, unknown>>;
      for (const m of msgs) {
        const textObj = m.text as Record<string, unknown> | undefined;
        const interactive = m.interactive as Record<string, unknown> | undefined;
        const buttonReply = interactive?.button_reply as Record<string, unknown> | undefined;
        const listReply = interactive?.list_reply as Record<string, unknown> | undefined;

        if (buttonReply) {
          messages.push({
            from: String(m.from ?? ""),
            messageId: String(m.id ?? ""),
            text: String(buttonReply.title ?? buttonReply.id ?? ""),
            replyId: String(buttonReply.id ?? ""),
            replyType: "button_reply",
            timestamp: Number(m.timestamp ?? 0),
          });
          continue;
        }

        if (listReply) {
          messages.push({
            from: String(m.from ?? ""),
            messageId: String(m.id ?? ""),
            text: String(listReply.title ?? listReply.id ?? ""),
            replyId: String(listReply.id ?? ""),
            replyType: "list_reply",
            timestamp: Number(m.timestamp ?? 0),
          });
          continue;
        }

        messages.push({
          from: String(m.from ?? ""),
          messageId: String(m.id ?? ""),
          text: String(textObj?.body ?? ""),
          replyType: "text",
          timestamp: Number(m.timestamp ?? 0),
        });
      }
    }
  }
  return messages;
}
