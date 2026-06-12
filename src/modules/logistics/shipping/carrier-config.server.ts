import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { listCarrierProviders } from "@/integrations/carriers";

export interface ClientCarrierConfigRow {
  id: string;
  provider: string;
  isActive: boolean;
  priority: number;
  autoSelect: boolean;
  credentialsRef: string | null;
}

export async function listClientCarrierConfigs(clientId: string): Promise<ClientCarrierConfigRow[]> {
  const { data, error } = await supabaseAdmin
    .from("client_carrier_configs")
    .select("id, provider, is_active, priority, auto_select, credentials_ref")
    .eq("client_id", clientId)
    .order("priority");

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: row.id as string,
    provider: row.provider as string,
    isActive: row.is_active as boolean,
    priority: row.priority as number,
    autoSelect: row.auto_select as boolean,
    credentialsRef: (row.credentials_ref as string | null) ?? null,
  }));
}

export function listAvailableCarrierProviders(): Array<{ id: string; name: string }> {
  return listCarrierProviders().map((p) => ({ id: p.id, name: p.name }));
}

export interface ClientOAuthConnectionOption {
  id: string;
  provider: string;
  externalAccount: string | null;
}

export async function listClientOAuthConnections(
  clientId: string,
): Promise<ClientOAuthConnectionOption[]> {
  const { data, error } = await supabaseAdmin
    .from("oauth_connections")
    .select("id, provider, external_account")
    .eq("client_id", clientId)
    .eq("is_active", true)
    .order("provider");

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: row.id as string,
    provider: row.provider as string,
    externalAccount: (row.external_account as string | null) ?? null,
  }));
}

export async function upsertClientCarrierConfig(
  clientId: string,
  input: {
    provider: string;
    isActive: boolean;
    priority: number;
    autoSelect: boolean;
    credentialsRef?: string;
  },
): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("client_carrier_configs")
    .upsert(
      {
        client_id: clientId,
        provider: input.provider,
        is_active: input.isActive,
        priority: input.priority,
        auto_select: input.autoSelect,
        credentials_ref: input.credentialsRef ?? null,
      },
      { onConflict: "client_id,provider" },
    )
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return data.id as string;
}
