import { createHmac, timingSafeEqual } from "node:crypto";

/** Validates Amazon SP-API / SNS notification authenticity when secret is configured. */
export function validateAmazonWebhook(
  rawBody: string,
  signature: string | null,
  clientSecret: string | undefined,
): boolean {
  if (!clientSecret) return true;
  if (!signature) return false;

  const expected = createHmac("sha256", clientSecret).update(rawBody).digest("base64");
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

export function parseAmazonSnsPayload(rawBody: string): {
  kind: "subscription" | "notification" | "direct";
  subscribeUrl?: string;
  payload: unknown;
} {
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return { kind: "direct", payload: {} };
  }

  if (body.Type === "SubscriptionConfirmation" && body.SubscribeURL) {
    return { kind: "subscription", subscribeUrl: String(body.SubscribeURL), payload: body };
  }

  if (body.Type === "Notification" && body.Message) {
    try {
      return { kind: "notification", payload: JSON.parse(String(body.Message)) };
    } catch {
      return { kind: "notification", payload: body.Message };
    }
  }

  return { kind: "direct", payload: body };
}
