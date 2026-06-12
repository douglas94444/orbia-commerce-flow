import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logAudit } from "@/shared/lib/logger";

export async function issueStoreCredit(input: {
  clientId: string;
  customerId?: string | null;
  amountCents: number;
  returnRequestId: string;
  notes?: string;
}): Promise<string> {
  if (input.amountCents <= 0) throw new Error("Valor de crédito inválido");

  const { data, error } = await supabaseAdmin
    .from("store_credits")
    .insert({
      client_id: input.clientId,
      customer_id: input.customerId ?? null,
      balance_cents: input.amountCents,
      source_return_id: input.returnRequestId,
      notes: input.notes ?? `Crédito devolução ${input.returnRequestId.slice(0, 8)}`,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  await supabaseAdmin
    .from("return_requests")
    .update({
      credit_issued: true,
      refund_cents: input.amountCents,
      resolution: "store_credit",
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.returnRequestId);

  await logAudit({
    user_id: "system",
    client_id: input.clientId,
    action: "create",
    resource: "store_credit",
    resource_id: data.id as string,
    new_data: { amount_cents: input.amountCents, return_request_id: input.returnRequestId },
  });

  return data.id as string;
}
