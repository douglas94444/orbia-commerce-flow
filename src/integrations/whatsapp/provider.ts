import { decryptToken } from "@/lib/crypto.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type WhatsAppProviderType = "meta" | "evolution";

export interface MetaWhatsAppCredentials {
  provider: "meta";
  accessToken: string;
  phoneNumberId: string;
}

export interface EvolutionWhatsAppCredentials {
  provider: "evolution";
  baseUrl: string;
  apiKey: string;
  instance: string;
}

export type WhatsAppCredentials = MetaWhatsAppCredentials | EvolutionWhatsAppCredentials;

export async function getWhatsAppProvider(clientId: string): Promise<WhatsAppProviderType> {
  const { data } = await supabaseAdmin
    .from("clients")
    .select("whatsapp_provider")
    .eq("id", clientId)
    .single();
  const provider = data?.whatsapp_provider as WhatsAppProviderType | undefined;
  return provider ?? "meta";
}

export async function getWhatsAppCredentials(clientId: string): Promise<WhatsAppCredentials | null> {
  const provider = await getWhatsAppProvider(clientId);

  if (provider === "evolution") {
    const baseUrl = process.env.EVOLUTION_API_URL;
    const apiKey = process.env.EVOLUTION_API_KEY;
    const { data } = await supabaseAdmin
      .from("oauth_connections")
      .select("metadata")
      .eq("client_id", clientId)
      .eq("provider", "whatsapp")
      .eq("is_active", true)
      .maybeSingle();
    const meta = (data?.metadata ?? {}) as Record<string, unknown>;
    const instance = String(meta.evolution_instance ?? process.env.EVOLUTION_INSTANCE_NAME ?? "");
    if (!baseUrl || !apiKey || !instance) return null;
    return { provider: "evolution", baseUrl, apiKey, instance };
  }

  const { data } = await supabaseAdmin
    .from("oauth_connections")
    .select("access_token, metadata")
    .eq("client_id", clientId)
    .eq("provider", "whatsapp")
    .eq("is_active", true)
    .maybeSingle();

  if (!data?.access_token) return null;
  const meta = (data.metadata ?? {}) as Record<string, unknown>;
  const phoneNumberId = String(meta.phone_number_id ?? "");
  if (!phoneNumberId) return null;
  return {
    provider: "meta",
    accessToken: decryptToken(data.access_token),
    phoneNumberId,
  };
}
