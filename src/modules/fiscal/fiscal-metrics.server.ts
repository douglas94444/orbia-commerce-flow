import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface FiscalMetricsSummary {
  periodDays: number;
  byType: Array<{
    type: string;
    total: number;
    authorized: number;
    rejected: number;
    pending: number;
    authRate: number;
    avgAuthMinutes: number | null;
  }>;
  topRejectionReasons: Array<{ reason: string; count: number }>;
  skusWithoutNcm: number;
  certExpiringSoon: boolean;
  certExpired: boolean;
}

export async function getFiscalMetrics(clientId: string, days = 30): Promise<FiscalMetricsSummary> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const [{ data: emissions }, { data: products }, { data: fiscal }] = await Promise.all([
    supabaseAdmin
      .from("nfe_emissions")
      .select("type, status, created_at, authorized_at, last_error")
      .eq("client_id", clientId)
      .gte("created_at", since),
    supabaseAdmin
      .from("products")
      .select("id, ncm")
      .eq("client_id", clientId)
      .eq("is_active", true),
    supabaseAdmin
      .from("fiscal_configs")
      .select("cert_expires_at")
      .eq("client_id", clientId)
      .maybeSingle(),
  ]);

  const rows = emissions ?? [];
  const types = ["NF-e", "NFC-e", "NFS-e"];
  const byType = types.map((type) => {
    const subset = rows.filter((r) => r.type === type);
    const total = subset.length;
    const authorized = subset.filter((r) => r.status === "autorizada").length;
    const rejected = subset.filter((r) => r.status === "rejeitada").length;
    const pending = subset.filter((r) => r.status === "pendente").length;
    const authRate = total > 0 ? Number(((authorized / total) * 100).toFixed(1)) : 0;

    const authDurations = subset
      .filter((r) => r.authorized_at)
      .map((r) => {
        const start = new Date(r.created_at).getTime();
        const end = new Date(r.authorized_at as string).getTime();
        return (end - start) / 60_000;
      });
    const avgAuthMinutes =
      authDurations.length > 0
        ? Number((authDurations.reduce((s, v) => s + v, 0) / authDurations.length).toFixed(1))
        : null;

    return { type, total, authorized, rejected, pending, authRate, avgAuthMinutes };
  });

  const reasonMap = new Map<string, number>();
  for (const r of rows.filter((e) => e.status === "rejeitada" && e.last_error)) {
    const key = String(r.last_error).slice(0, 100);
    reasonMap.set(key, (reasonMap.get(key) ?? 0) + 1);
  }
  const topRejectionReasons = [...reasonMap.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const skusWithoutNcm = (products ?? []).filter((p) => !p.ncm?.trim()).length;
  const expiresAt = fiscal?.cert_expires_at ? new Date(fiscal.cert_expires_at) : null;
  const certExpiringSoon = expiresAt
    ? expiresAt.getTime() - Date.now() < 30 * 24 * 60 * 60 * 1000 && expiresAt.getTime() > Date.now()
    : false;
  const certExpired = expiresAt ? expiresAt.getTime() < Date.now() : false;

  return {
    periodDays: days,
    byType,
    topRejectionReasons,
    skusWithoutNcm,
    certExpiringSoon,
    certExpired,
  };
}

export async function importTaxRulesFromCsv(
  clientId: string,
  csv: string,
): Promise<{ imported: number }> {
  const lines = csv.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return { imported: 0 };

  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const ufIdx = header.indexOf("uf_destino");
  const ncmIdx = header.indexOf("ncm_prefix");
  const icmsIdx = header.indexOf("icms_aliquota");
  const fcpIdx = header.indexOf("fcp_aliquota");
  const difalIdx = header.indexOf("difal_enabled");
  const ipiIdx = header.indexOf("ipi_cst");
  const mvaIdx = header.indexOf("mva_st");

  let imported = 0;
  for (const line of lines.slice(1)) {
    const cols = line.split(",").map((c) => c.trim());
    const uf = cols[ufIdx];
    if (!uf || uf.length !== 2) continue;

    const row = {
      client_id: clientId,
      uf_destino: uf.toUpperCase(),
      ncm_prefix: ncmIdx >= 0 ? (cols[ncmIdx] ?? "") : "",
      icms_aliquota: icmsIdx >= 0 && cols[icmsIdx] ? Number(cols[icmsIdx]) : null,
      fcp_aliquota: fcpIdx >= 0 && cols[fcpIdx] ? Number(cols[fcpIdx]) : 0,
      difal_enabled: difalIdx >= 0 ? cols[difalIdx]?.toLowerCase() === "true" : false,
      ipi_cst: ipiIdx >= 0 ? cols[ipiIdx] || null : null,
      mva_st: mvaIdx >= 0 && cols[mvaIdx] ? Number(cols[mvaIdx]) : null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabaseAdmin.from("fiscal_tax_rules").upsert(row, {
      onConflict: "client_id,uf_destino,ncm_prefix",
    });
    if (!error) imported++;
  }

  return { imported };
}
