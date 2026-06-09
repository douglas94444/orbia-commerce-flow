import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { dispatchOrder as dispatchOrderInternal } from "./shipping.server";
import type {
  Order,
  OrderStatus,
  NfStatus,
  SalesChannel,
  InventoryItem,
} from "@/shared/types/orbia";

// ─── Channel map ─────────────────────────────────────────────
const CHANNEL: Record<string, SalesChannel> = {
  mercado_livre: "Mercado Livre",
  shopee: "Shopee",
  amazon: "Amazon BR",
  tiktok: "TikTok Shop",
  instagram: "Instagram",
  nuvemshop: "Nuvemshop",
  shopify: "Shopify",
};

// ─── listOrders ───────────────────────────────────────────────

export const listOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Order[]> => {
    const { data, error } = await context.supabase
      .from("orders")
      .select("id, external_id, channel, status, nf_status, carrier, value_cents, city, tracking_code, clients(name)")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw new Error(error.message);

    return (data ?? []).map(
      (row: {
        id: string;
        external_id: string;
        channel: string;
        status: string;
        nf_status: string;
        carrier: string | null;
        value_cents: number;
        city: string | null;
        tracking_code: string | null;
        clients: { name: string } | null;
      }): Order => ({
        id: row.external_id,
        internalId: row.id,
        client: row.clients?.name ?? "—",
        channel: CHANNEL[row.channel] ?? (row.channel as SalesChannel),
        carrier: row.carrier ?? "—",
        status: row.status as OrderStatus,
        nf: row.nf_status as NfStatus,
        value: Math.round(row.value_cents / 100),
        city: row.city ?? "—",
        trackingCode: row.tracking_code,
      }),
    );
  });

// ─── getLogisticsStats ────────────────────────────────────────

export interface LogisticsStats {
  todayCount: number;
  awaitingNf: number;
  slaPercent: number;
  criticalSkus: number;
}

export const getLogisticsStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<LogisticsStats> => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [ordersResult, inventoryResult] = await Promise.all([
      context.supabase.from("orders").select("status, nf_status, created_at"),
      context.supabase.from("inventory").select("units"),
    ]);

    const orders = ordersResult.data ?? [];
    const inventory = inventoryResult.data ?? [];

    const todayCount = orders.filter(
      (o: { created_at: string }) => new Date(o.created_at) >= today,
    ).length;
    const awaitingNf = orders.filter(
      (o: { status: string }) => o.status === "aguardando_nf",
    ).length;
    const delivered = orders.filter((o: { status: string }) => o.status === "entregue").length;
    const total = orders.length;
    const slaPercent = total > 0 ? Math.round((delivered / total) * 100 * 10) / 10 : 0;
    const criticalSkus = inventory.filter((i: { units: number }) => i.units <= 5).length;

    return { todayCount, awaitingNf, slaPercent, criticalSkus };
  });

// ─── listInventory ────────────────────────────────────────────

export const listInventory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<InventoryItem[]> => {
    const { data, error } = await context.supabase
      .from("inventory")
      .select("sku, product, units, reserved, clients(name)")
      .order("units", { ascending: true });

    if (error) throw new Error(error.message);

    return (data ?? []).map(
      (row: {
        sku: string;
        product: string;
        units: number;
        reserved: number;
        clients: { name: string } | null;
      }): InventoryItem => {
        const available = row.units - (row.reserved ?? 0);
        return {
          sku: row.sku,
          product: row.product,
          client: row.clients?.name ?? "—",
          units: row.units,
          reserved: row.reserved ?? 0,
          available,
          level: available <= 5 ? "critico" : available <= 20 ? "atencao" : "ok",
        };
      },
    );
  });

// ─── dispatchOrder ────────────────────────────────────────────

async function requireStaffLogistics(
  userId: string,
  supabase: {
    from: (table: string) => ReturnType<import("@supabase/supabase-js").SupabaseClient["from"]>;
  },
) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();
  if (!profile || !["orbia_admin", "orbia_staff"].includes(profile.role as string)) {
    throw new Error("Apenas equipe Orbia pode despachar pedidos.");
  }
}

const dispatchSchema = z.object({ orderId: z.string().uuid() });

export const dispatchOrder = createServerFn({ method: "POST" })
  .inputValidator(dispatchSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await requireStaffLogistics(context.userId, context.supabase);
    return dispatchOrderInternal(data.orderId);
  });
