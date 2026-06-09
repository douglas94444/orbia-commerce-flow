import { logIntegration, startTimer } from "@/shared/lib/logger";

const GRAPH_BASE = "https://graph.facebook.com/v21.0";

export async function sendTemplateMessage(input: {
  phoneNumberId: string;
  accessToken: string;
  to: string;
  templateName: string;
  language: string;
  bodyParams?: string[];
  clientId?: string;
}): Promise<{ messageId: string }> {
  const end = startTimer();
  const to = input.to.replace(/\D/g, "");

  const components =
    input.bodyParams?.length ?
      [{ type: "body", parameters: input.bodyParams.map((t) => ({ type: "text", text: t })) }]
    : [];

  const res = await fetch(`${GRAPH_BASE}/${input.phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: input.templateName,
        language: { code: input.language },
        components,
      },
    }),
  });

  const text = await res.text();
  let body: { messages?: Array<{ id: string }>; error?: { message: string } } = {};
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
    client_id: input.clientId,
    error_message: res.ok ? undefined : body.error?.message ?? String(text).slice(0, 500),
  });

  if (!res.ok) throw new Error(body.error?.message ?? `WhatsApp API ${res.status}`);
  return { messageId: body.messages?.[0]?.id ?? "" };
}
