import { logIntegration, startTimer } from "@/shared/lib/logger";

interface EvolutionSendResult {
  key?: { id?: string };
  message?: string;
}

export async function sendEvolutionText(input: {
  baseUrl: string;
  apiKey: string;
  instance: string;
  to: string;
  text: string;
  clientId?: string;
}): Promise<{ messageId: string }> {
  const end = startTimer();
  const to = input.to.replace(/\D/g, "");
  const url = `${input.baseUrl.replace(/\/$/, "")}/message/sendText/${input.instance}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      apikey: input.apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ number: to, text: input.text }),
  });

  const text = await res.text();
  let body: EvolutionSendResult = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = {};
  }

  await logIntegration({
    provider: "evolution",
    operation: "send_whatsapp",
    status: res.ok ? "success" : "error",
    response_code: res.status,
    duration_ms: end(),
    client_id: input.clientId,
    error_message: res.ok ? undefined : body.message ?? String(text).slice(0, 500),
  });

  if (!res.ok) throw new Error(body.message ?? `Evolution API ${res.status}`);
  return { messageId: body.key?.id ?? "" };
}

export async function sendEvolutionDocument(input: {
  baseUrl: string;
  apiKey: string;
  instance: string;
  to: string;
  documentUrl: string;
  fileName: string;
  caption?: string;
  clientId?: string;
}): Promise<{ messageId: string }> {
  const end = startTimer();
  const to = input.to.replace(/\D/g, "");
  const url = `${input.baseUrl.replace(/\/$/, "")}/message/sendMedia/${input.instance}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      apikey: input.apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      number: to,
      mediatype: "document",
      media: input.documentUrl,
      fileName: input.fileName,
      caption: input.caption ?? "",
    }),
  });

  const text = await res.text();
  let body: EvolutionSendResult = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = {};
  }

  await logIntegration({
    provider: "evolution",
    operation: "send_whatsapp_document",
    status: res.ok ? "success" : "error",
    response_code: res.status,
    duration_ms: end(),
    client_id: input.clientId,
    error_message: res.ok ? undefined : body.message ?? String(text).slice(0, 500),
  });

  if (!res.ok) throw new Error(body.message ?? `Evolution API ${res.status}`);
  return { messageId: body.key?.id ?? "" };
}
