import { onDomainEvent } from "@/shared/lib/domain-events.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

onDomainEvent("prospect.created", async (payload) => {
  const prospectId = String(payload.prospectId ?? "");
  if (!prospectId) return;

  const dueAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const { data: prospect } = await supabaseAdmin
    .from("sales_prospects")
    .select("assigned_staff_id, contact_name, temperature")
    .eq("id", prospectId)
    .single();

  if (prospect?.assigned_staff_id) {
    await supabaseAdmin.from("sales_tasks").insert({
      prospect_id: prospectId,
      assigned_staff_id: prospect.assigned_staff_id,
      title: `Follow-up inicial — ${prospect.contact_name} (${prospect.temperature})`,
      due_at: dueAt,
      priority: prospect.temperature === "hot" ? "urgent" : "normal",
    });
  }
});

onDomainEvent("proposal.opened", async (payload) => {
  const prospectId = String(payload.prospectId ?? "");
  if (!prospectId) return;

  const { data: prospect } = await supabaseAdmin
    .from("sales_prospects")
    .select("assigned_staff_id, company_name")
    .eq("id", prospectId)
    .single();

  if (prospect?.assigned_staff_id) {
    await supabaseAdmin.from("sales_tasks").insert({
      prospect_id: prospectId,
      assigned_staff_id: prospect.assigned_staff_id,
      title: `Proposta aberta — ${prospect.company_name}`,
      due_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      priority: "high",
    });
  }
});

onDomainEvent("contract.signed", async (payload) => {
  const clientId = String(payload.clientId ?? "");
  const plan = String(payload.plan ?? "launch");
  if (!clientId) return;

  await supabaseAdmin.from("sales_interactions").insert({
    prospect_id: String(payload.prospectId ?? ""),
    kind: "note",
    notes: `Contrato assinado — cliente provisionado (${plan})`,
    metadata: { client_id: clientId, auto: true },
  });
});
