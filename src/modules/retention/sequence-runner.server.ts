import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendChannelMessage } from "./channel-senders";
import { pickAbVariant } from "./ab-testing.server";

const BATCH_SIZE = 100;
const ATTRIBUTION_DAYS = 7;

function isQuietHours(start: number, end: number, now = new Date()): boolean {
  const hour = now.getHours();
  if (start > end) return hour >= start || hour < end;
  return hour >= start && hour < end;
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

interface EnrollmentRow {
  id: string;
  sequence_id: string;
  customer_id: string | null;
  client_id: string;
  current_step_index: number;
  status: string;
  next_run_at: string;
  context: Record<string, unknown>;
}

interface StepRow {
  id: string;
  channel: string;
  delay_minutes: number;
  condition_type: string | null;
  template_key: string;
  sort_order: number;
  metadata: Record<string, unknown>;
}

async function getStoreName(clientId: string): Promise<string> {
  const { data } = await supabaseAdmin.from("clients").select("name").eq("id", clientId).single();
  return data?.name ?? "nossa loja";
}

async function getCustomerContact(customerId: string | null, context: Record<string, unknown>) {
  if (!customerId) {
    return {
      email: context.email ? String(context.email) : null,
      phone: context.phone ? String(context.phone) : null,
      optedOut: [] as string[],
    };
  }

  const { data: customer } = await supabaseAdmin
    .from("customers")
    .select("id, email_hash, phone_hash")
    .eq("id", customerId)
    .single();

  const { data: prefs } = await supabaseAdmin
    .from("customer_contact_prefs")
    .select("opted_out_channels")
    .eq("customer_id", customerId)
    .maybeSingle();

  return {
    email: context.email ? String(context.email) : null,
    phone: context.phone ? String(context.phone) : null,
    optedOut: (prefs?.opted_out_channels ?? []) as string[],
  };
}

async function evaluateCondition(
  condition: string | null,
  enrollment: EnrollmentRow,
  step: StepRow,
): Promise<boolean> {
  if (!condition) return true;

  if (condition === "previous_not_opened") {
    const { data: prevLogs } = await supabaseAdmin
      .from("message_delivery_log")
      .select("status, opened_at")
      .eq("enrollment_id", enrollment.id)
      .order("sent_at", { ascending: false })
      .limit(1);
    const prev = prevLogs?.[0];
    if (!prev) return true;
    return prev.status !== "opened" && !prev.opened_at;
  }

  if (condition.startsWith("rfm_segment:")) {
    const segment = condition.split(":")[1];
    if (!enrollment.customer_id) return false;
    const { data: c } = await supabaseAdmin
      .from("customers")
      .select("rfm_segment")
      .eq("id", enrollment.customer_id)
      .single();
    return c?.rfm_segment === segment;
  }

  return true;
}

async function processEnrollment(
  enrollment: EnrollmentRow,
  sequence: { quiet_hours_start: number; quiet_hours_end: number; sent_30d: number },
  steps: StepRow[],
): Promise<void> {
  if (isQuietHours(sequence.quiet_hours_start, sequence.quiet_hours_end)) {
    const nextMorning = new Date();
    nextMorning.setHours(sequence.quiet_hours_end, 0, 0, 0);
    if (nextMorning <= new Date()) nextMorning.setDate(nextMorning.getDate() + 1);
    await supabaseAdmin
      .from("automation_enrollments")
      .update({ next_run_at: nextMorning.toISOString(), updated_at: new Date().toISOString() })
      .eq("id", enrollment.id);
    return;
  }

  const stepIndex = enrollment.current_step_index;
  const step = steps[stepIndex];
  if (!step) {
    await supabaseAdmin
      .from("automation_enrollments")
      .update({ status: "completed", updated_at: new Date().toISOString() })
      .eq("id", enrollment.id);
    return;
  }

  const passes = await evaluateCondition(step.condition_type, enrollment, step);
  if (!passes) {
    await advanceEnrollment(enrollment, steps, stepIndex, step.delay_minutes);
    return;
  }

  const contact = await getCustomerContact(enrollment.customer_id, enrollment.context);
  if (contact.optedOut.includes(step.channel)) {
    await advanceEnrollment(enrollment, steps, stepIndex, step.delay_minutes);
    return;
  }

  const storeName = await getStoreName(enrollment.client_id);
  const abVariant = await pickAbVariant(step.id);
  const templateKey = abVariant ?? step.template_key;

  const result = await sendChannelMessage(step.channel, {
    clientId: enrollment.client_id,
    customerId: enrollment.customer_id,
    email: contact.email,
    phone: contact.phone,
    storeName,
    templateKey,
    metadata: step.metadata ?? {},
    enrollmentContext: enrollment.context,
  });

  const executionStatus = result.success ? "sent" : "failed";

  const { data: execution } = await supabaseAdmin
    .from("automation_executions")
    .insert({
      flow_id: null,
      customer_id: enrollment.customer_id,
      status: executionStatus,
      enrollment_id: enrollment.id,
      step_id: step.id,
      sequence_id: enrollment.sequence_id,
      metadata: {
        channel: step.channel,
        template_key: templateKey,
        provider_message_id: result.providerMessageId ?? null,
        error: result.error ?? null,
      },
    })
    .select("id")
    .single();

  if (result.providerMessageId && execution) {
    await supabaseAdmin.from("message_delivery_log").insert({
      execution_id: execution.id,
      enrollment_id: enrollment.id,
      channel: step.channel,
      provider_message_id: result.providerMessageId,
      status: result.success ? "sent" : "failed",
    });
  }

  if (result.success) {
    await supabaseAdmin
      .from("automation_sequences")
      .update({
        sent_30d: sequence.sent_30d + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", enrollment.sequence_id);
  }

  await advanceEnrollment(enrollment, steps, stepIndex, step.delay_minutes);
}

async function advanceEnrollment(
  enrollment: EnrollmentRow,
  steps: StepRow[],
  currentIndex: number,
  delayMinutes: number,
): Promise<void> {
  const nextIndex = currentIndex + 1;
  if (nextIndex >= steps.length) {
    await supabaseAdmin
      .from("automation_enrollments")
      .update({ status: "completed", updated_at: new Date().toISOString() })
      .eq("id", enrollment.id);
    return;
  }

  const nextStep = steps[nextIndex];
  const nextRun = addMinutes(new Date(), nextStep.delay_minutes || delayMinutes);

  await supabaseAdmin
    .from("automation_enrollments")
    .update({
      current_step_index: nextIndex,
      next_run_at: nextRun.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", enrollment.id);
}

export async function processAutomationEnrollments(): Promise<{ processed: number; errors: number }> {
  const now = new Date().toISOString();
  const { data: enrollments, error } = await supabaseAdmin
    .from("automation_enrollments")
    .select("id, sequence_id, customer_id, client_id, current_step_index, status, next_run_at, context")
    .eq("status", "active")
    .lte("next_run_at", now)
    .order("next_run_at", { ascending: true })
    .limit(BATCH_SIZE);

  if (error) throw new Error(error.message);

  let processed = 0;
  let errors = 0;

  for (const enrollment of (enrollments ?? []) as EnrollmentRow[]) {
    try {
      const { data: sequence } = await supabaseAdmin
        .from("automation_sequences")
        .select("id, quiet_hours_start, quiet_hours_end, sent_30d, status, is_active")
        .eq("id", enrollment.sequence_id)
        .single();

      if (!sequence?.is_active || sequence.status === "paused") continue;

      const { data: steps } = await supabaseAdmin
        .from("automation_steps")
        .select("id, channel, delay_minutes, condition_type, template_key, sort_order, metadata")
        .eq("sequence_id", enrollment.sequence_id)
        .order("sort_order", { ascending: true });

      if (!steps?.length) continue;

      await processEnrollment(enrollment, sequence, steps as StepRow[]);
      processed += 1;
    } catch (err) {
      console.error(`[sequence-runner] enrollment ${enrollment.id}:`, err);
      errors += 1;
    }
  }

  return { processed, errors };
}

export async function attributeConversions(): Promise<{ attributed: number }> {
  const since = new Date();
  since.setDate(since.getDate() - ATTRIBUTION_DAYS);

  const { data: recentExecutions } = await supabaseAdmin
    .from("automation_executions")
    .select("id, sequence_id, customer_id, sent_at")
    .eq("status", "sent")
    .gte("sent_at", since.toISOString())
    .not("sequence_id", "is", null);

  let attributed = 0;

  for (const exec of recentExecutions ?? []) {
    if (!exec.customer_id || !exec.sequence_id) continue;

    const { data: customer } = await supabaseAdmin
      .from("customers")
      .select("email_hash, client_id, last_order_at")
      .eq("id", exec.customer_id)
      .single();

    if (!customer?.last_order_at) continue;
    if (new Date(customer.last_order_at) < new Date(exec.sent_at)) continue;

    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("value_cents")
      .eq("client_id", customer.client_id)
      .in("status", ["pago", "separacao", "despachado", "em_transito", "entregue"])
      .gte("created_at", exec.sent_at)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!order?.value_cents) continue;

    await supabaseAdmin.rpc("increment_sequence_recovered", {
      p_sequence_id: exec.sequence_id,
      p_cents: order.value_cents,
    });

    await supabaseAdmin
      .from("automation_executions")
      .update({ status: "converted" })
      .eq("id", exec.id);

    attributed += 1;
  }

  return { attributed };
}
