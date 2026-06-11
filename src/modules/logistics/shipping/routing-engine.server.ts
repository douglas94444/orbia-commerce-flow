import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { quoteAllCarriers, type ShipmentQuote } from "@/integrations/carriers";
import { decryptToken } from "@/lib/crypto.server";
import { getServerConfig } from "@/lib/config.server";

export async function selectBestCarrier(
  clientId: string,
  input: {
    toPostalCode: string;
    weightKg: number;
    lengthCm?: number;
    widthCm?: number;
    heightCm?: number;
  },
): Promise<ShipmentQuote | null> {
  const { data: configs } = await supabaseAdmin
    .from("client_carrier_configs")
    .select("provider, auto_select, priority")
    .eq("client_id", clientId)
    .eq("is_active", true)
    .order("priority");

  const providerIds =
    configs?.length ?
      (configs as Array<{ provider: string }>).map((c) => c.provider)
    : ["melhor_envio"];

  const tokens: Record<string, string> = {};
  const { melhorEnvio } = getServerConfig();
  if (melhorEnvio.token) {
    tokens.melhor_envio = melhorEnvio.token;
  } else {
    const { data: conn } = await supabaseAdmin
      .from("oauth_connections")
      .select("access_token")
      .eq("client_id", clientId)
      .eq("provider", "melhor_envio")
      .eq("is_active", true)
      .maybeSingle();
    if (conn?.access_token) {
      tokens.melhor_envio = decryptToken(conn.access_token);
    }
  }

  const fromPostal = melhorEnvio.fromPostalCode ?? "01310100";
  const quotes = await quoteAllCarriers(
    providerIds,
    {
      fromPostalCode: fromPostal,
      toPostalCode: input.toPostalCode,
      weightKg: input.weightKg,
      lengthCm: input.lengthCm,
      widthCm: input.widthCm,
      heightCm: input.heightCm,
    },
    tokens,
  );

  return quotes[0] ?? null;
}

export async function getCarrierToken(
  clientId: string,
  providerId: string,
): Promise<string | null> {
  const { melhorEnvio } = getServerConfig();
  if (providerId === "melhor_envio" && melhorEnvio.token) return melhorEnvio.token;

  const { data: conn } = await supabaseAdmin
    .from("oauth_connections")
    .select("access_token")
    .eq("client_id", clientId)
    .eq("provider", providerId)
    .eq("is_active", true)
    .maybeSingle();

  return conn?.access_token ? decryptToken(conn.access_token) : null;
}
