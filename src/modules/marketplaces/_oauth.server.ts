import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { decryptToken } from "@/lib/crypto.server";

export type MarketplaceProvider =
  | "mercado_livre"
  | "shopee"
  | "amazon"
  | "tiktok"
  | "nuvemshop"
  | "shopify"
  | "instagram"
  | "meta";

export interface MarketplaceConnection {
  clientId: string;
  provider: MarketplaceProvider;
  accessToken: string;
  externalAccount: string;
  metadata: Record<string, unknown>;
}

export async function getMarketplaceConnection(
  clientId: string,
  provider: MarketplaceProvider,
): Promise<MarketplaceConnection | null> {
  const { data } = await supabaseAdmin
    .from("oauth_connections")
    .select("access_token, external_account, metadata")
    .eq("client_id", clientId)
    .eq("provider", provider)
    .eq("is_active", true)
    .maybeSingle();

  if (!data?.access_token) return null;

  return {
    clientId,
    provider,
    accessToken: decryptToken(data.access_token),
    externalAccount: data.external_account ?? "",
    metadata: (data.metadata ?? {}) as Record<string, unknown>,
  };
}

export async function listActiveMarketplaceClients(
  provider: MarketplaceProvider,
): Promise<string[]> {
  const { data } = await supabaseAdmin
    .from("oauth_connections")
    .select("client_id")
    .eq("provider", provider)
    .eq("is_active", true);

  return [...new Set((data ?? []).map((r) => r.client_id as string))];
}
