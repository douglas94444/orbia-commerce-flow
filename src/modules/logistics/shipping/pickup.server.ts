import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { decryptToken } from "@/lib/crypto.server";
import { logAudit, logIntegration } from "@/shared/lib/logger";

export interface CarrierPickupRow {
  id: string;
  provider: string;
  scheduledAt: string;
  orderCount: number;
  status: string;
  notes: string | null;
}

export async function listCarrierPickups(clientId: string): Promise<CarrierPickupRow[]> {
  const { data, error } = await supabaseAdmin
    .from("carrier_pickups")
    .select("id, provider, scheduled_at, order_count, status, notes")
    .eq("client_id", clientId)
    .order("scheduled_at", { ascending: false })
    .limit(50);

  if (error) throw new Error(error.message);

  return (data ?? []).map((r) => ({
    id: r.id as string,
    provider: r.provider as string,
    scheduledAt: r.scheduled_at as string,
    orderCount: r.order_count as number,
    status: r.status as string,
    notes: r.notes as string | null,
  }));
}

export async function scheduleCarrierPickup(
  clientId: string,
  input: { provider: string; scheduledAt: string; notes?: string },
  userId?: string,
): Promise<CarrierPickupRow> {
  const since = new Date();
  since.setHours(0, 0, 0, 0);

  const { count } = await supabaseAdmin
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .eq("status", "despachado")
    .gte("updated_at", since.toISOString());

  const { data, error } = await supabaseAdmin
    .from("carrier_pickups")
    .insert({
      client_id: clientId,
      provider: input.provider,
      scheduled_at: input.scheduledAt,
      order_count: count ?? 0,
      status: "scheduled",
      notes: input.notes ?? null,
    })
    .select("id, provider, scheduled_at, order_count, status, notes")
    .single();

  if (error) throw new Error(error.message);

  if (input.provider === "melhor_envio" || input.provider === "melhor envio") {
    const { data: conn } = await supabaseAdmin
      .from("oauth_connections")
      .select("access_token")
      .eq("client_id", clientId)
      .eq("provider", "melhor_envio")
      .eq("is_active", true)
      .maybeSingle();

    if (conn?.access_token) {
      const sinceShip = new Date();
      sinceShip.setDate(sinceShip.getDate() - 7);

      const { data: shipped } = await supabaseAdmin
        .from("orders")
        .select("metadata")
        .eq("client_id", clientId)
        .eq("status", "despachado")
        .gte("updated_at", sinceShip.toISOString())
        .limit(50);

      const shipmentIds = (shipped ?? [])
        .map((o) => (o.metadata as Record<string, unknown>)?.me_shipment_id)
        .filter((id): id is string => typeof id === "string");

      const { requestMelhorEnvioCollect } = await import("@/integrations/melhor-envio/client");
      const collect = await requestMelhorEnvioCollect(
        decryptToken(conn.access_token),
        shipmentIds,
      );

      await supabaseAdmin
        .from("carrier_pickups")
        .update({
          notes: [input.notes, collect.message].filter(Boolean).join(" — "),
          status: collect.requested ? "requested" : "scheduled",
        })
        .eq("id", data.id);

      await logIntegration({
        client_id: clientId,
        provider: "melhor_envio",
        operation: "request_collect",
        status: collect.requested ? "success" : "error",
        metadata: { shipmentCount: collect.shipmentCount },
      });
    }
  }

  if (userId) {
    await logAudit({
      user_id: userId,
      client_id: clientId,
      action: "create",
      resource: "carrier_pickup",
      resource_id: data.id as string,
      new_data: input,
    });
  }

  return {
    id: data.id as string,
    provider: data.provider as string,
    scheduledAt: data.scheduled_at as string,
    orderCount: data.order_count as number,
    status: data.status as string,
    notes: data.notes as string | null,
  };
}
