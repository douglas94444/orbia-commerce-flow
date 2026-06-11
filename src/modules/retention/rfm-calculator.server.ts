import { createHash } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type RfmSegment =
  | "campeoes"
  | "leais"
  | "em_risco"
  | "hibernando"
  | "perdidos"
  | "novos"
  | "potencial";

function hashEmail(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

function scoreRecency(days: number): number {
  if (days <= 30) return 5;
  if (days <= 60) return 4;
  if (days <= 90) return 3;
  if (days <= 180) return 2;
  return 1;
}

function scoreFrequency(count: number): number {
  if (count >= 10) return 5;
  if (count >= 6) return 4;
  if (count >= 3) return 3;
  if (count >= 2) return 2;
  return 1;
}

function scoreMonetary(cents: number): number {
  if (cents >= 10_000_000) return 5; // R$100k
  if (cents >= 5_000_000) return 4;  // R$50k
  if (cents >= 1_000_000) return 3;  // R$10k
  if (cents >= 100_000) return 2;    // R$1k
  return 1;
}

function classifySegment(r: number, f: number, m: number, orderCount: number): RfmSegment {
  if (orderCount === 1 && r >= 4) return "novos";
  if (r >= 4 && f >= 4) return "campeoes";
  if (r >= 3 && f >= 3 && m >= 3) return "leais";
  if (r <= 2 && f >= 3) return "em_risco";
  if (r <= 2 && f <= 2 && m >= 2) return "hibernando";
  if (r >= 3 && f <= 2 && m >= 3) return "potencial";
  return "perdidos";
}

export async function computeRfmSegments(): Promise<{
  processed: number;
  segments: Record<RfmSegment, number>;
}> {
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  // Load orders from the last 90 days with customer email from metadata
  const { data: orders, error } = await supabaseAdmin
    .from("orders")
    .select("client_id, value_cents, created_at, status, metadata")
    .neq("status", "cancelado")
    .gte("created_at", ninetyDaysAgo.toISOString());

  if (error) throw new Error(`RFM: failed to load orders: ${error.message}`);

  // Aggregate by (client_id, email_hash)
  type AggKey = string;
  const agg = new Map<
    AggKey,
    { clientId: string; emailHash: string; lastOrder: Date; count: number; total: number }
  >();

  for (const o of orders ?? []) {
    if (!o.client_id) continue;
    const meta = (o.metadata ?? {}) as Record<string, unknown>;
    const rawEmail = String(meta.customer_email ?? "").trim().toLowerCase();
    if (!rawEmail) continue;

    const emailHash = hashEmail(rawEmail);
    const key: AggKey = `${o.client_id}:${emailHash}`;
    const dt = new Date(o.created_at);
    const cur = agg.get(key);
    if (!cur) {
      agg.set(key, { clientId: o.client_id, emailHash, lastOrder: dt, count: 1, total: o.value_cents ?? 0 });
    } else {
      if (dt > cur.lastOrder) cur.lastOrder = dt;
      cur.count += 1;
      cur.total += o.value_cents ?? 0;
    }
  }

  // Load existing customers indexed by (client_id, email_hash)
  const { data: customers } = await supabaseAdmin
    .from("customers")
    .select("id, client_id, email_hash");

  const customerMap = new Map<string, string>();
  for (const c of customers ?? []) {
    customerMap.set(`${c.client_id}:${c.email_hash}`, c.id);
  }

  const now = Date.now();
  const segCounts: Record<RfmSegment, number> = {
    campeoes: 0, leais: 0, em_risco: 0, hibernando: 0, perdidos: 0, novos: 0, potencial: 0,
  };

  type UpsertRow = {
    id: string;
    rfm_segment: RfmSegment;
    rfm_score: string;
    rfm_last_calc: string;
    rfm_recency_days: number;
    rfm_frequency: number;
    rfm_monetary_cents: number;
    updated_at: string;
  };
  const upsertRows: UpsertRow[] = [];

  for (const [key, data] of agg) {
    const customerId = customerMap.get(key);
    if (!customerId) continue;

    const recencyDays = Math.floor((now - data.lastOrder.getTime()) / 86_400_000);
    const r = scoreRecency(recencyDays);
    const f = scoreFrequency(data.count);
    const m = scoreMonetary(data.total);
    const segment = classifySegment(r, f, m, data.count);

    segCounts[segment] += 1;
    upsertRows.push({
      id: customerId,
      rfm_segment: segment,
      rfm_score:
        segment === "campeoes" ? "campiao"
        : segment === "leais" ? "fiel"
        : segment === "em_risco" ? "em_risco"
        : segment === "hibernando" ? "hibernando"
        : "indefinido",
      rfm_last_calc: new Date().toISOString(),
      rfm_recency_days: recencyDays,
      rfm_frequency: data.count,
      rfm_monetary_cents: data.total,
      updated_at: new Date().toISOString(),
    });
  }

  // Upsert in batches of 100 (cast: rfm_* columns added in 023_rfm_columns migration)
  for (let i = 0; i < upsertRows.length; i += 100) {
    await (supabaseAdmin as any)
      .from("customers")
      .upsert(upsertRows.slice(i, i + 100), { onConflict: "id" });
  }

  return { processed: upsertRows.length, segments: segCounts };
}
