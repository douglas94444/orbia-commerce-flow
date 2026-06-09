import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logAudit } from "@/shared/lib/logger";
import type { NormalizedOrderItem } from "./order-ingestion.server";

export interface StockItem {
  sku: string;
  quantity: number;
}

export async function reserveStock(clientId: string, items: StockItem[]): Promise<void> {
  for (const item of items) {
    if (item.quantity <= 0) continue;
    const { error } = await supabaseAdmin.rpc("reserve_inventory", {
      p_client_id: clientId,
      p_sku: item.sku,
      p_qty: item.quantity,
    });
    if (error) throw new Error(`Reserve failed for ${item.sku}: ${error.message}`);
    await logAudit({
      user_id: "system",
      client_id: clientId,
      action: "create",
      resource: "stock_reservation",
      resource_id: `${clientId}:${item.sku}`,
      new_data: { operation: "reserve", sku: item.sku, quantity: item.quantity },
    });
  }
}

export async function releaseStock(clientId: string, items: StockItem[]): Promise<void> {
  for (const item of items) {
    if (item.quantity <= 0) continue;
    const { error } = await supabaseAdmin.rpc("release_inventory", {
      p_client_id: clientId,
      p_sku: item.sku,
      p_qty: item.quantity,
    });
    if (error) throw new Error(`Release failed for ${item.sku}: ${error.message}`);
    await logAudit({
      user_id: "system",
      client_id: clientId,
      action: "update",
      resource: "stock_reservation",
      resource_id: `${clientId}:${item.sku}`,
      new_data: { operation: "release", sku: item.sku, quantity: item.quantity },
    });
  }
}

export async function commitStock(clientId: string, items: StockItem[]): Promise<void> {
  for (const item of items) {
    if (item.quantity <= 0) continue;
    const { error } = await supabaseAdmin.rpc("commit_inventory", {
      p_client_id: clientId,
      p_sku: item.sku,
      p_qty: item.quantity,
    });
    if (error) throw new Error(`Commit failed for ${item.sku}: ${error.message}`);
    await logAudit({
      user_id: "system",
      client_id: clientId,
      action: "update",
      resource: "stock_reservation",
      resource_id: `${clientId}:${item.sku}`,
      new_data: { operation: "commit", sku: item.sku, quantity: item.quantity },
    });
  }
}

export function itemsFromOrderMetadata(
  items: NormalizedOrderItem[] | undefined,
): StockItem[] {
  return (items ?? []).map((i) => ({ sku: i.sku, quantity: i.quantity }));
}
