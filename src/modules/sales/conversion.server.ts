import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logAudit, logJob, startTimer } from "@/shared/lib/logger";
import { emitDomainEvent } from "@/shared/lib/domain-events.server";
import { ensureOnboardingTasks } from "@/modules/admin/admin.server";
import { getStageIdByKey } from "./lead-scoring.server";
import { ensureCommercialOnboarding } from "./onboarding/commercial-onboarding.server";
import { createPartnerCommission } from "./partners/partners.server";

export async function convertProspectToClient(
  prospectId: string,
  staffUserId: string,
  plan: "launch" | "growth" | "scale",
): Promise<{ clientId: string }> {
  const end = startTimer();

  const { data: prospect, error } = await supabaseAdmin
    .from("sales_prospects")
    .select("*")
    .eq("id", prospectId)
    .single();

  if (error || !prospect) throw new Error("Prospect não encontrado.");
  if (prospect.converted_client_id) {
    return { clientId: prospect.converted_client_id };
  }

  const slug = prospect.company_name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const { data: client, error: clientErr } = await supabaseAdmin
    .from("clients")
    .insert({
      name: prospect.company_name,
      slug: `${slug}-${Date.now().toString(36)}`,
      plan,
      segment: prospect.segment,
      status: "onboarding",
      onboarding_week: 1,
    })
    .select("id")
    .single();

  if (clientErr) throw new Error(clientErr.message);

  await supabaseAdmin.from("client_members").insert({
    client_id: client.id,
    user_id: staffUserId,
    role: "admin",
  });

  const activeStageId = await getStageIdByKey("active_client");
  await supabaseAdmin
    .from("sales_prospects")
    .update({
      converted_client_id: client.id,
      converted_at: new Date().toISOString(),
      stage_id: activeStageId,
    })
    .eq("id", prospectId);

  await ensureOnboardingTasks(client.id);
  await ensureCommercialOnboarding(client.id, prospectId);

  if (prospect.partner_id) {
    await createPartnerCommission(prospect.partner_id, prospectId, client.id, plan);
  }

  await logAudit({
    user_id: staffUserId,
    client_id: client.id,
    action: "create",
    resource: "client",
    resource_id: client.id,
    metadata: { from_prospect: prospectId },
  });

  await emitDomainEvent("contract.signed", {
    prospectId,
    clientId: client.id,
    plan,
  });

  await logJob({
    job_type: "sales_conversion",
    job_id: prospectId,
    client_id: client.id,
    status: "completed",
    duration_ms: end(),
  });

  return { clientId: client.id };
}
