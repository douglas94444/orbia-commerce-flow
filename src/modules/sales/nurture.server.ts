import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";

const FOLLOW_UP_STEPS = [
  { day: 1, template: "followup_d1_questions", channel: "email" },
  { day: 3, template: "followup_d3_case_study", channel: "email" },
  { day: 5, template: "followup_d5_call", channel: "whatsapp" },
  { day: 10, template: "followup_d10_urgency", channel: "whatsapp" },
] as const;

const COLD_NURTURE_INTERVAL_DAYS = 15;

/** Agenda metadata de sequência de follow-up pós-proposta no prospect. */
export async function scheduleProposalFollowUp(prospectId: string): Promise<void> {
  const startedAt = new Date().toISOString();
  await supabaseAdmin
    .from("sales_prospects")
    .update({
      metadata: {
        nurture_sequence: "proposal_followup",
        nurture_started_at: startedAt,
        nurture_steps: FOLLOW_UP_STEPS.map((s) => ({
          ...s,
          scheduled_at: new Date(Date.now() + s.day * 86400000).toISOString(),
          sent: false,
        })),
      },
    })
    .eq("id", prospectId);
}

/** Processa follow-ups pendentes (cron). */
export async function processSalesNurtureBatch(): Promise<number> {
  const { data: prospects } = await supabaseAdmin
    .from("sales_prospects")
    .select("id, email, whatsapp, contact_name, company_name, metadata, communications_opt_out")
    .is("converted_client_id", null)
    .eq("communications_opt_out", false)
    .not("metadata->nurture_sequence", "is", null)
    .limit(50);

  let sent = 0;
  const now = Date.now();

  for (const p of prospects ?? []) {
    const meta = (p.metadata as Record<string, unknown>) ?? {};
    const steps = (meta.nurture_steps as Array<Record<string, unknown>>) ?? [];
    let updated = false;

    for (const step of steps) {
      if (step.sent) continue;
      const scheduled = new Date(String(step.scheduled_at)).getTime();
      if (scheduled > now) continue;

      const channel = String(step.channel);
      const contact = channel === "whatsapp" ? p.whatsapp ?? p.phone : p.email;
      if (!contact) continue;

      await supabaseAdmin.from("sales_interactions").insert({
        prospect_id: p.id,
        kind: "email",
        channel,
        notes: `[Automático] Follow-up ${step.template}`,
        metadata: { auto: true, template: step.template } as Json,
      });

      step.sent = true;
      updated = true;
      sent++;
    }

    if (updated) {
      await supabaseAdmin
        .from("sales_prospects")
        .update({ metadata: { ...meta, nurture_steps: steps } as Json })
        .eq("id", p.id);
    }
  }

  return sent;
}

/** Move prospect para nutrição longa (disse "não agora"). */
export async function enrollColdNurture(prospectId: string): Promise<void> {
  await supabaseAdmin
    .from("sales_prospects")
    .update({
      temperature: "cold",
      metadata: {
        nurture_sequence: "cold_long",
        next_nurture_at: new Date(Date.now() + COLD_NURTURE_INTERVAL_DAYS * 86400000).toISOString(),
      },
    })
    .eq("id", prospectId);
}
