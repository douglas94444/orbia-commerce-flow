import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logAudit } from "@/shared/lib/logger";
import type { NfEmission, NfStatus } from "@/shared/types/orbia";
import { canCancelWithinWindow } from "./fiscal-ops.server";

function mapEmissionRow(row: {
  id: string;
  type: string;
  status: string;
  value_cents: number;
  retries: number;
  created_at: string;
  access_key: string | null;
  last_error: string | null;
  danfe_url: string | null;
  xml_url: string | null;
  order_id: string | null;
  external_ref: string | null;
  authorized_at: string | null;
  clients: { name: string } | null;
}): NfEmission {
  const created = new Date(row.created_at);
  return {
    id: row.id.slice(0, 12).toUpperCase(),
    emissionId: row.id,
    client: row.clients?.name ?? "—",
    type: row.type as NfEmission["type"],
    status: row.status as NfStatus,
    value: Math.round(row.value_cents / 100),
    retries: row.retries,
    time: created.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    date: created.toLocaleDateString("pt-BR"),
    accessKey: row.access_key,
    lastError: row.last_error,
    danfeUrl: row.danfe_url,
    xmlUrl: row.xml_url,
    orderId: row.order_id,
    externalRef: row.external_ref,
    authorizedAt: row.authorized_at,
    canCancel: row.status === "autorizada" && canCancelWithinWindow(row.authorized_at),
  };
}

// ─── listNfEmissions ──────────────────────────────────────────

export const listNfEmissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<NfEmission[]> => {
    const { data, error } = await context.supabase
      .from("nfe_emissions")
      .select(
        "id, type, status, value_cents, retries, created_at, access_key, last_error, danfe_url, xml_url, order_id, external_ref, authorized_at, clients(name)",
      )
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => mapEmissionRow(row as Parameters<typeof mapEmissionRow>[0]));
  });

// ─── getNfeEmissionDetail ─────────────────────────────────────

export const getNfeEmissionDetail = createServerFn({ method: "GET" })
  .inputValidator(z.object({ emissionId: z.string().uuid() }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }): Promise<NfEmission | null> => {
    const { data: row, error } = await context.supabase
      .from("nfe_emissions")
      .select(
        "id, type, status, value_cents, retries, created_at, access_key, last_error, danfe_url, xml_url, order_id, external_ref, authorized_at, clients(name)",
      )
      .eq("id", data.emissionId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!row) return null;
    return mapEmissionRow(row as Parameters<typeof mapEmissionRow>[0]);
  });

// ─── getFiscalConfig ──────────────────────────────────────────

export interface FiscalConfig {
  id: string;
  cnpj: string;
  companyName: string;
  taxRegime: string;
  defaultCfop: string | null;
  defaultCst: string | null;
  defaultNcm: string | null;
  certExpiresAt: string | null;
  certPath: string | null;
  hasCertPassword: boolean;
  certExpiringSoon: boolean;
}

export const getFiscalConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FiscalConfig | null> => {
    const { data: member } = await context.supabase
      .from("client_members")
      .select("client_id")
      .eq("user_id", context.userId)
      .eq("status", "active")
      .single();

    if (!member) return null;

    const { data, error } = await supabaseAdmin
      .from("fiscal_configs")
      .select(
        "id, cnpj, company_name, tax_regime, default_cfop, default_cst, default_ncm, cert_expires_at, cert_path, cert_password",
      )
      .eq("client_id", member.client_id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return null;

    const expiresAt = data.cert_expires_at ? new Date(data.cert_expires_at) : null;
    const certExpiringSoon = expiresAt
      ? expiresAt.getTime() - Date.now() < 30 * 24 * 60 * 60 * 1000
      : false;

    return {
      id: data.id,
      cnpj: data.cnpj,
      companyName: data.company_name,
      taxRegime: data.tax_regime,
      defaultCfop: data.default_cfop,
      defaultCst: data.default_cst,
      defaultNcm: data.default_ncm,
      certExpiresAt: data.cert_expires_at,
      certPath: data.cert_path,
      hasCertPassword: Boolean(data.cert_password),
      certExpiringSoon,
    };
  });

// ─── upsertFiscalConfig ───────────────────────────────────────

const fiscalConfigSchema = z.object({
  cnpj: z.string().regex(/^\d{14}$/, "CNPJ deve ter 14 dígitos sem pontuação"),
  companyName: z.string().min(2).max(150),
  taxRegime: z.enum(["simples", "lucro_presumido", "lucro_real"]),
  defaultCfop: z.string().max(10).optional().nullable(),
  defaultCst: z.string().max(10).optional().nullable(),
  defaultNcm: z.string().max(10).optional().nullable(),
});

export type FiscalConfigInput = z.infer<typeof fiscalConfigSchema>;

export const upsertFiscalConfig = createServerFn({ method: "POST" })
  .inputValidator(fiscalConfigSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { data: member } = await context.supabase
      .from("client_members")
      .select("client_id")
      .eq("user_id", context.userId)
      .eq("status", "active")
      .single();

    if (!member) throw new Error("Nenhum cliente associado a este usuário.");
    const clientId = member.client_id;

    const { data: config, error } = await supabaseAdmin
      .from("fiscal_configs")
      .upsert(
        {
          client_id: clientId,
          cnpj: data.cnpj,
          company_name: data.companyName,
          tax_regime: data.taxRegime,
          default_cfop: data.defaultCfop ?? null,
          default_cst: data.defaultCst ?? null,
          default_ncm: data.defaultNcm ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "client_id" },
      )
      .select("id")
      .single();

    if (error) throw new Error(error.message);

    await logAudit({
      user_id: context.userId,
      client_id: clientId,
      action: "update",
      resource: "fiscal_config",
      resource_id: config.id,
      new_data: data,
    });

    return { success: true };
  });

// ─── getFiscalStats ───────────────────────────────────────────

export interface FiscalStats {
  emitted30d: number;
  successRate: number;
  reprocessing: number;
  rejectedToday: number;
  certExpiringSoon: boolean;
  missingCert: boolean;
  rejectionReasons: Array<{ reason: string; count: number }>;
}

export const getFiscalStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FiscalStats> => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [{ data: rows }, { data: config }] = await Promise.all([
      context.supabase
        .from("nfe_emissions")
        .select("status, retries, created_at, last_error")
        .gte("created_at", thirtyDaysAgo),
      context.supabase
        .from("fiscal_configs")
        .select("cert_path, cert_expires_at")
        .maybeSingle(),
    ]);

    const emissions = rows ?? [];
    const emitted30d = emissions.length;
    const authorized = emissions.filter((r) => r.status === "autorizada").length;
    const successRate = emitted30d > 0 ? Number(((authorized / emitted30d) * 100).toFixed(1)) : 0;
    const reprocessing = emissions.filter(
      (r) =>
        (r.status === "pendente" || r.status === "rejeitada") &&
        (r.retries ?? 0) > 0 &&
        (r.retries ?? 0) < 3,
    ).length;
    const rejectedToday = emissions.filter(
      (r) => r.status === "rejeitada" && new Date(r.created_at) >= today,
    ).length;

    const reasonMap = new Map<string, number>();
    for (const r of emissions.filter((e) => e.status === "rejeitada" && e.last_error)) {
      const key = String(r.last_error).slice(0, 80);
      reasonMap.set(key, (reasonMap.get(key) ?? 0) + 1);
    }
    const rejectionReasons = [...reasonMap.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const expiresAt = config?.cert_expires_at ? new Date(config.cert_expires_at) : null;
    const certExpiringSoon = expiresAt
      ? expiresAt.getTime() - Date.now() < 30 * 24 * 60 * 60 * 1000
      : false;

    return {
      emitted30d,
      successRate,
      reprocessing,
      rejectedToday,
      certExpiringSoon,
      missingCert: !config?.cert_path,
      rejectionReasons,
    };
  });

// ─── uploadFiscalCertificate ──────────────────────────────────

const certUploadSchema = z.object({
  fileBase64: z.string().min(1),
  fileName: z.string().regex(/\.(pfx|p12)$/i, "Apenas arquivos .pfx ou .p12"),
  certPassword: z.string().min(1).optional(),
  certExpiresAt: z.string().datetime().optional(),
});

export const uploadFiscalCertificate = createServerFn({ method: "POST" })
  .inputValidator(certUploadSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { data: member } = await context.supabase
      .from("client_members")
      .select("client_id")
      .eq("user_id", context.userId)
      .eq("status", "active")
      .single();

    if (!member) throw new Error("Nenhum cliente associado a este usuário.");
    const clientId = member.client_id;
    const storagePath = `${clientId}/cert.pfx`;
    const buffer = Buffer.from(data.fileBase64, "base64");

    const { error: uploadError } = await supabaseAdmin.storage
      .from("fiscal-certificates")
      .upload(storagePath, buffer, {
        contentType: "application/x-pkcs12",
        upsert: true,
      });

    if (uploadError) throw new Error(`Upload falhou: ${uploadError.message}`);

    const { error: updateError } = await supabaseAdmin
      .from("fiscal_configs")
      .update({
        cert_path: storagePath,
        cert_password: data.certPassword ?? null,
        cert_expires_at: data.certExpiresAt ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("client_id", clientId);

    if (updateError) throw new Error(updateError.message);

    await logAudit({
      user_id: context.userId,
      client_id: clientId,
      action: "update",
      resource: "fiscal_certificate",
      new_data: { cert_path: storagePath, file_name: data.fileName, has_password: Boolean(data.certPassword) },
    });

    return { success: true, certPath: storagePath };
  });

// ─── retryNfeEmissionFn ───────────────────────────────────────

export const retryNfeEmissionFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ emissionId: z.string().uuid() }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { retryNfeEmission } = await import("./fiscal-ops.server");
    await retryNfeEmission(data.emissionId);
    await logAudit({
      user_id: context.userId,
      action: "nfe_retry",
      resource: "nfe_emission",
      resource_id: data.emissionId,
    });
    return { success: true };
  });

// ─── cancelNfeEmissionFn ──────────────────────────────────────

export const cancelNfeEmissionFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      emissionId: z.string().uuid(),
      justificativa: z.string().min(15).max(255),
    }),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { cancelNfeEmission } = await import("./fiscal-ops.server");
    await cancelNfeEmission(data.emissionId, data.justificativa);
    await logAudit({
      user_id: context.userId,
      action: "nfe_cancel",
      resource: "nfe_emission",
      resource_id: data.emissionId,
    });
    return { success: true };
  });

// ─── exportNfePeriodCsv ───────────────────────────────────────

export const exportNfePeriodCsv = createServerFn({ method: "GET" })
  .inputValidator(z.object({ days: z.number().optional() }).optional())
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const days = data?.days ?? 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const { data: rows, error } = await context.supabase
      .from("nfe_emissions")
      .select("id, type, status, value_cents, access_key, danfe_url, xml_url, created_at, authorized_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    const header =
      "id,tipo,status,valor_cents,chave_acesso,danfe_url,xml_url,criado_em,autorizado_em";
    const lines = (rows ?? []).map((r) =>
      [
        r.id,
        r.type,
        r.status,
        r.value_cents,
        r.access_key ?? "",
        r.danfe_url ?? "",
        r.xml_url ?? "",
        r.created_at,
        r.authorized_at ?? "",
      ].join(","),
    );

    return {
      csv: [header, ...lines].join("\n"),
      filename: `nfe-export-${days}d.csv`,
    };
  });
