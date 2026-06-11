import { getServerConfig } from "@/lib/config.server";
import { logIntegration, startTimer } from "@/shared/lib/logger";

export async function sendSms(input: {
  to: string;
  body: string;
  clientId?: string;
}): Promise<{ sid: string }> {
  const { twilio } = getServerConfig();
  if (!twilio.accountSid || !twilio.authToken || !twilio.fromNumber) {
    throw new Error("Twilio not configured (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER)");
  }

  const to = input.to.replace(/\D/g, "");
  const end = startTimer();
  const url = `https://api.twilio.com/2010-04-01/Accounts/${twilio.accountSid}/Messages.json`;
  const auth = Buffer.from(`${twilio.accountSid}:${twilio.authToken}`).toString("base64");

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      To: to.startsWith("55") ? `+${to}` : `+55${to}`,
      From: twilio.fromNumber,
      Body: input.body,
    }),
  });

  const text = await res.text();
  let body: { sid?: string } = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = {};
  }

  await logIntegration({
    provider: "twilio",
    operation: "send_sms",
    status: res.ok ? "success" : "error",
    response_code: res.status,
    duration_ms: end(),
    client_id: input.clientId,
    error_message: res.ok ? undefined : String(text).slice(0, 500),
  });

  if (!res.ok) throw new Error(`Twilio API ${res.status}: ${String(text).slice(0, 200)}`);
  return { sid: body.sid ?? "sent" };
}
