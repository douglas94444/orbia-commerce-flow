import { getServerConfig } from "@/lib/config.server";
import { logIntegration, startTimer } from "@/shared/lib/logger";
import { sendFcmV1Message } from "./v1.server";
import { sendWebPushNotification } from "./webpush.server";

const WEBPUSH_PREFIX = "webpush:";

export async function sendPushNotification(input: {
  token: string;
  title: string;
  body: string;
  clientId?: string;
}): Promise<{ messageId: string }> {
  const { fcm } = getServerConfig();

  if (input.token.startsWith(WEBPUSH_PREFIX)) {
    const subscriptionJson = input.token.slice(WEBPUSH_PREFIX.length);
    return sendWebPushNotification({
      subscriptionJson,
      title: input.title,
      body: input.body,
      clientId: input.clientId,
    });
  }

  if (fcm.projectId && fcm.serviceAccountJson) {
    const end = startTimer();
    try {
      const result = await sendFcmV1Message({
        token: input.token,
        title: input.title,
        body: input.body,
        projectId: fcm.projectId,
      });
      await logIntegration({
        provider: "fcm",
        operation: "send_push_v1",
        status: "success",
        duration_ms: end(),
        client_id: input.clientId,
      });
      return result;
    } catch (err) {
      await logIntegration({
        provider: "fcm",
        operation: "send_push_v1",
        status: "error",
        duration_ms: end(),
        client_id: input.clientId,
        error_message: (err as Error).message.slice(0, 500),
      });
      throw err;
    }
  }

  if (!fcm.serverKey) throw new Error("FCM not configured");

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
    operation: "send_push_legacy",
    status: res.ok ? "success" : "error",
    response_code: res.status,
    duration_ms: end(),
    client_id: input.clientId,
    error_message: res.ok ? undefined : String(text).slice(0, 500),
  });

  if (!res.ok) throw new Error(`FCM API ${res.status}: ${String(text).slice(0, 200)}`);
  return { messageId: String(body.message_id ?? "sent") };
}
