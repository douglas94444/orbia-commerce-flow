import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type ReturnResolution = "refund" | "exchange" | "store_credit";
export type ReturnApprovalMode = "auto" | "manual";

export interface ReturnPolicy {
  clientId: string;
  approvalMode: ReturnApprovalMode;
  defaultResolution: ReturnResolution;
  allowExchange: boolean;
  allowStoreCredit: boolean;
  autoApproveExchange: boolean;
  whatsappPhone: string | null;
}

const DEFAULT_POLICY: Omit<ReturnPolicy, "clientId"> = {
  approvalMode: "manual",
  defaultResolution: "refund",
  allowExchange: true,
  allowStoreCredit: true,
  autoApproveExchange: false,
  whatsappPhone: null,
};

function mapRow(row: Record<string, unknown>, clientId: string): ReturnPolicy {
  return {
    clientId,
    approvalMode: (row.approval_mode as ReturnApprovalMode) ?? "manual",
    defaultResolution: (row.default_resolution as ReturnResolution) ?? "refund",
    allowExchange: Boolean(row.allow_exchange ?? true),
    allowStoreCredit: Boolean(row.allow_store_credit ?? true),
    autoApproveExchange: Boolean(row.auto_approve_exchange ?? false),
    whatsappPhone: (row.whatsapp_phone as string | null) ?? null,
  };
}

export async function getReturnPolicy(clientId: string): Promise<ReturnPolicy> {
  const { data } = await supabaseAdmin
    .from("return_policies")
    .select(
      "approval_mode, default_resolution, allow_exchange, allow_store_credit, auto_approve_exchange, whatsapp_phone",
    )
    .eq("client_id", clientId)
    .maybeSingle();

  if (!data) return { clientId, ...DEFAULT_POLICY };
  return mapRow(data as Record<string, unknown>, clientId);
}

export async function upsertReturnPolicy(
  clientId: string,
  input: Partial<Omit<ReturnPolicy, "clientId">>,
): Promise<ReturnPolicy> {
  const { data, error } = await supabaseAdmin
    .from("return_policies")
    .upsert(
      {
        client_id: clientId,
        approval_mode: input.approvalMode ?? DEFAULT_POLICY.approvalMode,
        default_resolution: input.defaultResolution ?? DEFAULT_POLICY.defaultResolution,
        allow_exchange: input.allowExchange ?? DEFAULT_POLICY.allowExchange,
        allow_store_credit: input.allowStoreCredit ?? DEFAULT_POLICY.allowStoreCredit,
        auto_approve_exchange: input.autoApproveExchange ?? DEFAULT_POLICY.autoApproveExchange,
        whatsapp_phone: input.whatsappPhone ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "client_id" },
    )
    .select(
      "approval_mode, default_resolution, allow_exchange, allow_store_credit, auto_approve_exchange, whatsapp_phone",
    )
    .single();

  if (error) throw new Error(error.message);
  return mapRow(data as Record<string, unknown>, clientId);
}
