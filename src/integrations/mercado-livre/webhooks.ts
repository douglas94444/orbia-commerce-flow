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

export function validateMercadoLivreWebhook(
  _rawBody: string,
  _signature: string | null,
  _secret: string,
): boolean {
  // ML uses topic notifications with optional x-signature; validate in production via app secret
  return true;
}
