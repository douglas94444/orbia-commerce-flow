import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface OperatorScope {
  role: string;
  allowedSkus: string[] | null;
  warehouseId: string | null;
}

export async function getOperatorScope(
  userId: string,
  clientId: string,
): Promise<OperatorScope | null> {
  const { data: membership } = await supabaseAdmin
    .from("client_members")
    .select("role, allowed_skus, warehouse_scope_id")
    .eq("user_id", userId)
    .eq("client_id", clientId)
    .eq("status", "active")
    .maybeSingle();

  if (!membership) return null;

  const role = membership.role as string;
  const rawSkus = membership.allowed_skus as string[] | null;
  const allowedSkus =
    role === "fulfillment_operator" && rawSkus && rawSkus.length > 0 ? rawSkus : null;

  const warehouseId =
    role === "fulfillment_operator"
      ? ((membership.warehouse_scope_id as string | null) ?? null)
      : null;

  return { role, allowedSkus, warehouseId };
}

export function isSkuInOperatorScope(scope: OperatorScope | null, sku: string): boolean {
  if (!scope?.allowedSkus) return true;
  return scope.allowedSkus.includes(sku);
}

export async function updateOperatorScope(
  clientId: string,
  memberUserId: string,
  input: { allowedSkus?: string[]; warehouseId?: string | null },
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("client_members")
    .update({
      allowed_skus: input.allowedSkus ?? [],
      warehouse_scope_id: input.warehouseId ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("client_id", clientId)
    .eq("user_id", memberUserId);

  if (error) throw new Error(error.message);
}
