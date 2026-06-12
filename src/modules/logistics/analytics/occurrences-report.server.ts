import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface OccurrenceRow {
  id: string;
  type: "incident" | "return" | "quarantine";
  title: string;
  status: string;
  createdAt: string;
  orderId: string | null;
}

export async function listUnifiedOccurrences(
  clientId: string,
  days = 30,
): Promise<OccurrenceRow[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data: clientOrders } = await supabaseAdmin
    .from("orders")
    .select("id")
    .eq("client_id", clientId);
  const orderIds = (clientOrders ?? []).map((o) => o.id as string);

  const [incidents, returns, quarantine] = await Promise.all([
    orderIds.length
      ? supabaseAdmin
          .from("delivery_incidents")
          .select("id, incident_type, resolved, created_at, order_id")
          .in("order_id", orderIds)
          .gte("created_at", since.toISOString())
          .order("created_at", { ascending: false })
          .limit(100)
      : Promise.resolve({ data: [] }),
    supabaseAdmin
      .from("return_requests")
      .select("id, reason, status, created_at, order_id")
      .eq("client_id", clientId)
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: false })
      .limit(100),
    supabaseAdmin
      .from("quarantine_items")
      .select("id, reason, status, created_at, sku")
      .eq("client_id", clientId)
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const rows: OccurrenceRow[] = [];

  for (const i of incidents.data ?? []) {
    rows.push({
      id: i.id as string,
      type: "incident",
      title: String(i.incident_type ?? "incidente entrega"),
      status: (i.resolved as boolean) ? "resolved" : "open",
      createdAt: i.created_at as string,
      orderId: i.order_id as string,
    });
  }
  for (const r of returns.data ?? []) {
    rows.push({
      id: r.id as string,
      type: "return",
      title: String(r.reason ?? "devolução"),
      status: r.status as string,
      createdAt: r.created_at as string,
      orderId: r.order_id as string,
    });
  }
  for (const q of quarantine.data ?? []) {
    rows.push({
      id: q.id as string,
      type: "quarantine",
      title: `Quarentena ${q.sku as string}: ${q.reason as string}`,
      status: q.status as string,
      createdAt: q.created_at as string,
      orderId: null,
    });
  }

  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function exportOccurrencesCsv(clientId: string, days = 30): Promise<string> {
  const rows = await listUnifiedOccurrences(clientId, days);
  const lines = ["type,id,title,status,order_id,created_at"];
  for (const r of rows) {
    lines.push(
      `${r.type},${r.id},"${r.title.replace(/"/g, '""')}",${r.status},${r.orderId ?? ""},${r.createdAt}`,
    );
  }
  return lines.join("\n");
}
