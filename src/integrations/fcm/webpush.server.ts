import { getServerConfig } from "@/lib/config.server";
import { logIntegration, startTimer } from "@/shared/lib/logger";

export async function sendWebPushNotification(input: {
  subscriptionJson: string;
  title: string;
  body: string;
  clientId?: string;
}): Promise<{ messageId: string }> {
  const { fcm } = getServerConfig();
  if (!fcm.vapidPublicKey || !fcm.vapidPrivateKey) {
    throw new Error("VAPID keys not configured");
  }

  const end = startTimer();
  let webpush: typeof import("web-push");
  try {
    webpush = await import("web-push");
  } catch {
    throw new Error("web-push package not installed");
  }

  webpush.setVapidDetails(fcm.vapidSubject, fcm.vapidPublicKey, fcm.vapidPrivateKey);

  const subscription = JSON.parse(input.subscriptionJson) as import("web-push").PushSubscription;
  const result = await webpush.sendNotification(
    subscription,
    JSON.stringify({ title: input.title, body: input.body }),
  );

  await logIntegration({
    provider: "fcm",
    operation: "send_webpush",
    status: "success",
    duration_ms: end(),
    client_id: input.clientId,
    response_code: result.statusCode,
  });

  return { messageId: String(result.headers?.location ?? "sent") };
}
