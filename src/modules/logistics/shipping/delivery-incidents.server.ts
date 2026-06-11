import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface DeliveryIncidentRow {
  id: string;
  orderId: string;
  incidentType: string;
  description: string | null;
  resolved: boolean;
  createdAt: string;
  city: string | null;
  channel: string | null;
}

export async function listDeliveryIncidents(clientId: string): Promise<DeliveryIncidentRow[]> {
  const { data: orders } = await supabaseAdmin
    .from("orders")
    .select("id, city, channel")
    .eq("client_id", clientId);

  const orderMap = new Map(
    (orders ?? []).map((o) => [
      o.id as string,
      { city: o.city as string | null, channel: o.channel as string | null },
    ]),
  );

  const orderIds = [...orderMap.keys()];
  if (!orderIds.length) return [];

  const { data: incidents, error } = await supabaseAdmin
    .from("delivery_incidents")
    .select("id, order_id, incident_type, description, resolved, created_at")
    .in("order_id", orderIds)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw new Error(error.message);

  return (incidents ?? []).map((r) => {
    const order = orderMap.get(r.order_id as string);
    return {
      id: r.id as string,
      orderId: r.order_id as string,
      incidentType: r.incident_type as string,
      description: r.description as string | null,
      resolved: r.resolved as boolean,
      createdAt: r.created_at as string,
      city: order?.city ?? null,
      channel: order?.channel ?? null,
    };
  });
}

export interface RegionHeatPoint {
  city: string;
  count: number;
}

export function buildIncidentHeatMap(incidents: DeliveryIncidentRow[]): RegionHeatPoint[] {
  const map = new Map<string, number>();
  for (const i of incidents) {
    const city = i.city ?? "Desconhecido";
    map.set(city, (map.get(city) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([city, count]) => ({ city, count }))
    .sort((a, b) => b.count - a.count);
}
