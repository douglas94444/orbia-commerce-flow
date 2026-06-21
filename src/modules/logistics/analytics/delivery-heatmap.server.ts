import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { resolveCityCoords } from "@/shared/lib/br-city-coords";

export interface DeliveryHeatPoint {
  city: string;
  state: string | null;
  delivered: number;
  inTransit: number;
  incidents: number;
  lat: number | null;
  lng: number | null;
}

export async function buildDeliveryHeatMap(clientId: string, days = 30): Promise<DeliveryHeatPoint[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data: orders } = await supabaseAdmin
    .from("orders")
    .select("city, status")
    .eq("client_id", clientId)
    .in("status", ["em_transito", "entregue", "despachado"])
    .gte("updated_at", since.toISOString())
    .limit(2000);

  const map = new Map<string, DeliveryHeatPoint>();

  for (const o of orders ?? []) {
    const city = o.city || "Desconhecida";
    const state: string | null = null;
    const key = `${city}|${state ?? ""}`;
    const coords = resolveCityCoords(city, state);
    const entry = map.get(key) ?? {
      city,
      state,
      delivered: 0,
      inTransit: 0,
      incidents: 0,
      lat: coords?.[0] ?? null,
      lng: coords?.[1] ?? null,
    };
    if (o.status === "entregue") entry.delivered += 1;
    else entry.inTransit += 1;
    map.set(key, entry);
  }

  const { data: incidents } = await supabaseAdmin
    .from("delivery_incidents")
    .select("orders!inner(client_id, city)")
    .eq("orders.client_id", clientId)
    .gte("created_at", since.toISOString())
    .limit(500);

  for (const inc of incidents ?? []) {
    const city = inc.orders?.city || "Desconhecida";
    const state: string | null = null;
    const key = `${city}|${state ?? ""}`;
    const coords = resolveCityCoords(city, state);
    const entry = map.get(key) ?? {
      city,
      state,
      delivered: 0,
      inTransit: 0,
      incidents: 0,
      lat: coords?.[0] ?? null,
      lng: coords?.[1] ?? null,
    };
    entry.incidents += 1;
    map.set(key, entry);
  }

  return [...map.values()].sort(
    (a, b) => b.delivered + b.inTransit + b.incidents - (a.delivered + a.inTransit + a.incidents),
  );
}
