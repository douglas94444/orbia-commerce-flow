import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { encryptToken, decryptToken } from "@/lib/crypto.server";
import { refreshMercadoLivreToken } from "@/integrations/mercado-livre/oauth";
import { refreshGoogleToken } from "@/integrations/google/oauth";
import { refreshMelhorEnvioToken } from "@/integrations/melhor-envio/oauth";
import { logIntegration } from "@/shared/lib/logger";

type RefreshableProvider = "mercado_livre" | "google" | "melhor_envio";
const REFRESHABLE: RefreshableProvider[] = ["mercado_livre", "google", "melhor_envio"];

async function doRefresh(
  provider: RefreshableProvider,
  refreshToken: string,
): Promise<{ accessToken: string; newRefreshToken?: string; expiresIn: number }> {
  switch (provider) {
    case "mercado_livre": {
      const t = await refreshMercadoLivreToken(refreshToken);
      return { accessToken: t.access_token, newRefreshToken: t.refresh_token, expiresIn: t.expires_in };
    }
    case "google": {
      const t = await refreshGoogleToken(refreshToken);
      return { accessToken: t.access_token, expiresIn: t.expires_in };
    }
    case "melhor_envio": {
      const t = await refreshMelhorEnvioToken(refreshToken);
      return { accessToken: t.access_token, newRefreshToken: t.refresh_token, expiresIn: t.expires_in };
    }
  }
}

export async function refreshExpiredTokens(): Promise<{
  refreshed: number;
  failed: number;
}> {
  const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  const { data: expiring, error } = await supabaseAdmin
    .from("oauth_connections")
    .select("id, client_id, provider, refresh_token, token_expires_at")
    .in("provider", REFRESHABLE)
    .eq("is_active", true)
    .not("refresh_token", "is", null)
    .or(`token_expires_at.is.null,token_expires_at.lt.${oneHourFromNow}`);

  if (error) throw new Error(`refresh-tokens: query failed: ${error.message}`);

  let refreshed = 0;
  let failed = 0;

  for (const conn of expiring ?? []) {
    const rawRefreshToken = conn.refresh_token as string;
    if (!rawRefreshToken) continue;

    const provider = conn.provider as RefreshableProvider;
    const decryptedRefresh = decryptToken(rawRefreshToken);

    try {
      const result = await doRefresh(provider, decryptedRefresh);
      const expiresAt = new Date(Date.now() + result.expiresIn * 1000).toISOString();

      await supabaseAdmin
        .from("oauth_connections")
        .update({
          access_token: encryptToken(result.accessToken),
          refresh_token: result.newRefreshToken
            ? encryptToken(result.newRefreshToken)
            : rawRefreshToken,
          token_expires_at: expiresAt,
          last_refreshed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", conn.id);

      await logIntegration({
        client_id: conn.client_id,
        provider,
        operation: "token_refresh",
        status: "success",
      });

      refreshed += 1;
    } catch (err) {
      console.error(`[refresh-tokens] ${provider} client ${conn.client_id} failed:`, err);
      await logIntegration({
        client_id: conn.client_id,
        provider,
        operation: "token_refresh",
        status: "error",
        error_message: (err as Error).message,
      });
      failed += 1;
    }
  }

  return { refreshed, failed };
}
