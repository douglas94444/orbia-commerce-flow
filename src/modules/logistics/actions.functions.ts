import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { dispatchOrder as dispatchOrderInternal } from "./shipping.server";
import { getSlaDashboard } from "./sla/sla-engine.server";
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

    const [ordersResult, inventoryResult, productsResult] = await Promise.all([
      context.supabase.from("orders").select("status, nf_status, created_at"),
      context.supabase.from("inventory").select("sku, units, reserved"),
      context.supabase.from("products").select("sku, min_stock_units"),
    ]);

    const orders = ordersResult.data ?? [];
    const inventory = inventoryResult.data ?? [];
    const products = productsResult.data ?? [];

    const minMap = new Map(
      (products as Array<{ sku: string; min_stock_units: number }>).map((p) => [
        p.sku,
        p.min_stock_units ?? 0,
      ]),
    );

    const todayCount = orders.filter(
      (o: { created_at: string }) => new Date(o.created_at) >= today,
    ).length;
    const awaitingNf = orders.filter(
      (o: { status: string }) => o.status === "aguardando_nf",
    ).length;
    const { data: member } = await context.supabase
      .from("client_members")
      .select("client_id")
      .eq("user_id", context.userId)
      .maybeSingle();

    let slaPercent = 100;
    if (member?.client_id) {
      const slaDash = await getSlaDashboard(member.client_id as string);
      slaPercent = slaDash.compliancePercent;
    }

    const criticalSkus = (inventory as Array<{ sku: string; units: number; reserved: number }>).filter(
      (i) => {
        const available = i.units - (i.reserved ?? 0);
        const min = minMap.get(i.sku) ?? 0;
        return min > 0 ? available <= min : available <= 5;
      },
    ).length;

    return { todayCount, awaitingNf, slaPercent, criticalSkus };
  });

// ─── listInventory ────────────────────────────────────────────

export const listInventory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<InventoryItem[]> => {
    const [invResult, prodResult] = await Promise.all([
      context.supabase
        .from("inventory")
        .select("sku, product, units, reserved, clients(name)")
        .order("units", { ascending: true }),
      context.supabase.from("products").select("sku, min_stock_units"),
    ]);

    if (invResult.error) throw new Error(invResult.error.message);

    const minMap = new Map(
      (prodResult.data ?? []).map((p: { sku: string; min_stock_units: number }) => [
        p.sku,
        p.min_stock_units ?? 0,
      ]),
    );

    return (invResult.data ?? []).map(
      (row: {
        sku: string;
        product: string;
        units: number;
        reserved: number;
        clients: { name: string } | null;
      }): InventoryItem => {
        const available = row.units - (row.reserved ?? 0);
        const min = minMap.get(row.sku) ?? 0;
        const level =
          min > 0
            ? available <= min
              ? "critico"
              : available <= min * 2
                ? "atencao"
                : "ok"
            : available <= 5
              ? "critico"
              : available <= 20
                ? "atencao"
                : "ok";
        return {
          sku: row.sku,
          product: row.product,
          client: row.clients?.name ?? "—",
          units: row.units,
          reserved: row.reserved ?? 0,
          available,
          level,
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
    return dispatchOrderInternal(data.orderId, context.userId);
  });

async function resolveClientId(
  supabase: { rpc: (fn: string) => Promise<{ data: string | null; error: unknown }>; from: (t: string) => unknown },
): Promise<string> {
  const { data: clientId } = await supabase.rpc("current_client_id");
  if (clientId) return clientId;
  const q = supabase.from("clients") as {
    select: (c: string) => { limit: (n: number) => Promise<{ data: Array<{ id: string }> | null }> };
  };
  const { data: clients } = await q.select("id").limit(1);
  if (!clients?.[0]?.id) throw new Error("Cliente não identificado");
  return clients[0].id;
}

const unifiedQueueSchema = z.object({
  channel: z.string().optional(),
  status: z.string().optional(),
  fulfillmentType: z.string().optional(),
  limit: z.number().optional(),
}).optional();

export const getUnifiedOrderQueueFn = createServerFn({ method: "GET" })
  .inputValidator(unifiedQueueSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const clientId = await resolveClientId(context.supabase);
    const { getUnifiedOrderQueue } = await import("./analytics/unified-orders.server");
    return getUnifiedOrderQueue(clientId, {
      channel: data?.channel,
      status: data?.status,
      fulfillmentType: data?.fulfillmentType,
      limit: data?.limit ?? 50,
    });
  });
