import { createHmac, timingSafeEqual } from "node:crypto";
import { getServerConfig } from "@/lib/config.server";
import { mlFetch } from "./client";

export async function registerMercadoLivreWebhooks(
  userId: string,
  accessToken: string,
): Promise<void> {
  const { appUrl } = getServerConfig();
  const url = `${appUrl}/api/webhooks/mercado-livre`;

  await mlFetch("/applications/" + getServerConfig().mercadoLivre.clientId + "/notifications", accessToken, {
    method: "POST",
    body: JSON.stringify({ url, topics: ["orders_v2", "payments"] }),
  }).catch(() => {
    // ML app notifications may need dashboard config — non-fatal
  });

  void userId;
}

/**
 * Validates Mercado Livre x-signature header.
 * Format: ts=1704908010,v1=hexdigest
 * Manifest: id:[data.id URL];request-id:[x-request-id];ts:[ts];
 */
export function validateMercadoLivreWebhook(
  rawBody: string,
  signature: string | null,
  secret: string,
  requestId?: string | null,
): boolean {
  if (!signature || !secret) return false;

  const parts = Object.fromEntries(
    signature.split(",").map((p) => {
      const [k, v] = p.split("=");
      return [k?.trim(), v?.trim()];
    }),
  );

  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;

  let dataId = "";
  try {
    const body = JSON.parse(rawBody) as Record<string, unknown>;
    const data = body.data as Record<string, unknown> | undefined;
    dataId = String(data?.id ?? body.id ?? "");
    if (!dataId && body.resource) {
      dataId = String(body.resource).split("/").pop() ?? "";
    }
  } catch {
    return false;
  }

  const reqId = requestId ?? "";
  const manifest = `id:${dataId};request-id:${reqId};ts:${ts};`;
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");

  try {
    const a = Buffer.from(v1, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
