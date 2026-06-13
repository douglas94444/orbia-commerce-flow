import { supabaseAdmin } from "@/integrations/supabase/client.server";

/** Atribui prospect ao staff com menor carga ativa (round-robin por contagem). */
export async function assignProspectRoundRobin(): Promise<string | null> {
  const { data: staff } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .in("role", ["orbia_admin", "orbia_staff"]);

  if (!staff?.length) return null;

  const { data: counts } = await supabaseAdmin
    .from("sales_prospects")
    .select("assigned_staff_id")
    .is("converted_client_id", null);

  const load = new Map<string, number>();
  for (const s of staff) load.set(s.id, 0);
  for (const row of counts ?? []) {
    if (row.assigned_staff_id) {
      load.set(row.assigned_staff_id, (load.get(row.assigned_staff_id) ?? 0) + 1);
    }
  }

  let minId = staff[0].id;
  let minCount = load.get(minId) ?? 0;
  for (const s of staff) {
    const c = load.get(s.id) ?? 0;
    if (c < minCount) {
      minCount = c;
      minId = s.id;
    }
  }
  return minId;
}
