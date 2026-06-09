import { getServerConfig } from "@/lib/config.server";
import { logIntegration, startTimer } from "@/shared/lib/logger";

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  clientId?: string;
}

export async function sendEmail(input: SendEmailInput): Promise<{ id: string }> {
  const { resend } = getServerConfig();
  if (!resend.apiKey) throw new Error("RESEND_API_KEY not configured");
  if (!resend.fromEmail) throw new Error("RESEND_FROM_EMAIL not configured");

  const end = startTimer();
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resend.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: resend.fromEmail,
      to: input.to,
      subject: input.subject,
      html: input.html,
    }),
  });

  const text = await res.text();
  let body: { id?: string } = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = {};
  }

  await logIntegration({
    client_id: input.clientId,
    provider: "resend",
    operation: "send_email",
    status: res.ok ? "success" : "error",
    response_code: res.status,
    duration_ms: end(),
    error_message: res.ok ? undefined : String(text).slice(0, 500),
  });

  if (!res.ok) throw new Error(`Resend API ${res.status}: ${String(text).slice(0, 200)}`);
  return { id: body.id ?? "sent" };
}
