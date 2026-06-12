import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface PackingProfile {
  clientId: string;
  checklistItems: string[];
  brandingUrl: string | null;
  insertMaterialSku: string | null;
}

const DEFAULT_CHECKLIST = [
  "Conferir itens do pedido",
  "Incluir nota fiscal / DANFE",
  "Selar embalagem",
  "Colar etiqueta de envio",
];

function mapRow(row: Record<string, unknown>, clientId: string): PackingProfile {
  const items = row.checklist_items;
  return {
    clientId,
    checklistItems: Array.isArray(items)
      ? items.map(String)
      : DEFAULT_CHECKLIST,
    brandingUrl: (row.branding_url as string | null) ?? null,
    insertMaterialSku: (row.insert_material_sku as string | null) ?? null,
  };
}

export async function getPackingProfile(clientId: string): Promise<PackingProfile> {
  const { data } = await supabaseAdmin
    .from("client_packing_profiles")
    .select("checklist_items, branding_url, insert_material_sku")
    .eq("client_id", clientId)
    .maybeSingle();

  if (!data) {
    return {
      clientId,
      checklistItems: DEFAULT_CHECKLIST,
      brandingUrl: null,
      insertMaterialSku: null,
    };
  }
  return mapRow(data as Record<string, unknown>, clientId);
}

export async function upsertPackingProfile(
  clientId: string,
  input: Partial<Omit<PackingProfile, "clientId">>,
): Promise<PackingProfile> {
  const { data, error } = await supabaseAdmin
    .from("client_packing_profiles")
    .upsert(
      {
        client_id: clientId,
        checklist_items: input.checklistItems ?? DEFAULT_CHECKLIST,
        branding_url: input.brandingUrl ?? null,
        insert_material_sku: input.insertMaterialSku ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "client_id" },
    )
    .select("checklist_items, branding_url, insert_material_sku")
    .single();

  if (error) throw new Error(error.message);
  return mapRow(data as Record<string, unknown>, clientId);
}

export function getDefaultChecklist(): string[] {
  return [...DEFAULT_CHECKLIST];
}
