import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logJob, startTimer } from "@/shared/lib/logger";

const FIVE_YEARS_MS = 5 * 365.25 * 24 * 60 * 60 * 1000;

export async function runFiscalXmlArchiveJob(): Promise<{
  checked: number;
  archived: number;
  missing: number;
}> {
  const end = startTimer();
  const cutoff = new Date(Date.now() - FIVE_YEARS_MS).toISOString();

  const { data: oldEmissions } = await supabaseAdmin
    .from("nfe_emissions")
    .select("id, client_id, external_ref, xml_storage_path, created_at")
    .eq("status", "autorizada")
    .lt("created_at", cutoff)
    .not("xml_storage_path", "is", null)
    .limit(100);

  let checked = 0;
  let archived = 0;
  let missing = 0;

  for (const e of oldEmissions ?? []) {
    checked++;
    const path = e.xml_storage_path as string;
    const { data: files } = await supabaseAdmin.storage.from("nfe-xml").list(path.split("/")[0], {
      search: path.split("/").pop(),
    });

    if (!files?.length) {
      missing++;
      await supabaseAdmin
        .from("nfe_emissions")
        .update({
          metadata: { archive_check: "missing", checked_at: new Date().toISOString() },
          updated_at: new Date().toISOString(),
        })
        .eq("id", e.id);
      continue;
    }

    archived++;
    await supabaseAdmin
      .from("nfe_emissions")
      .update({
        metadata: { archive_check: "ok", checked_at: new Date().toISOString() },
        updated_at: new Date().toISOString(),
      })
      .eq("id", e.id);
  }

  await logJob({
    job_type: "fiscal-xml-archive",
    job_id: `archive-${Date.now()}`,
    status: "completed",
    duration_ms: end(),
    metadata: { checked, archived, missing },
  });

  return { checked, archived, missing };
}
