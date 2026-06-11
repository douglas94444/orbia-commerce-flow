import { getServerConfig } from "@/lib/config.server";
import { logIntegration, startTimer } from "@/shared/lib/logger";

export async function sendPushNotification(input: {
  token: string;
  title: string;
  body: string;
  clientId?: string;
}): Promise<{ messageId: string }> {
  const { fcm } = getServerConfig();
  if (!fcm.serverKey) throw new Error("FCM_SERVER_KEY not configured");

  const end = startTimer();
  const res = await fetch("https://fcm.googleapis.com/fcm/send", {
    method: "POST",
    headers: {
      Authorization: `key=${fcm.serverKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: input.token,
      notification: { title: input.title, body: input.body },
    }),
  });

  const text = await res.text();
  let body: { message_id?: number } = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = {};
  }

  await logIntegration({
    provider: "fcm",
    operation: "send_push",
    status: res.ok ? "success" : "error",
    response_code: res.status,
    duration_ms: end(),
    client_id: input.clientId,
    error_message: res.ok ? undefined : String(text).slice(0, 500),
  });

  if (!res.ok) throw new Error(`FCM API ${res.status}: ${String(text).slice(0, 200)}`);
  return { messageId: String(body.message_id ?? "sent") };
}
