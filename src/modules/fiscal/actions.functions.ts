import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logAudit } from "@/shared/lib/logger";
import type { NfEmission, NfStatus } from "@/shared/types/orbia";

// ─── listNfEmissions ──────────────────────────────────────────

export const listNfEmissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<NfEmission[]> => {
    const { data, error } = await context.supabase
      .from("nfe_emissions")
      .select("id, type, status, value_cents, retries, created_at, clients(name)")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw new Error(error.message);

    return (data ?? []).map(
      (row: {
        id: string;
        type: string;
        status: string;
        value_cents: number;
        retries: number;
        created_at: string;
        clients: { name: string } | null;
      }): NfEmission => ({
        id: row.id.slice(0, 12).toUpperCase(), // short display ID
        client: row.clients?.name ?? "—",
        type: row.type as NfEmission["type"],
        status: row.status as NfStatus,
        value: Math.round(row.value_cents / 100),
        retries: row.retries,
        time: new Date(row.created_at).toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      }),
    );
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
}

export const getFiscalConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FiscalConfig | null> => {
    const { data, error } = await context.supabase
      .from("fiscal_configs")
      .select(
        "id, cnpj, company_name, tax_regime, default_cfop, default_cst, default_ncm, cert_expires_at, cert_path",
      )
      .single();

    if (error) {
      if (error.code === "PGRST116") return null; // no row — not configured yet
      throw new Error(error.message);
    }

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
    // Resolve client_id from membership (client_id never comes from frontend)
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
  successRate: number; // 0–100
  reprocessing: number; // status pendente with retries > 0
  rejectedToday: number;
}

export const getFiscalStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FiscalStats> => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data } = await context.supabase
      .from("nfe_emissions")
      .select("status, retries, created_at")
      .gte("created_at", thirtyDaysAgo);

    const rows = data ?? [];
    const emitted30d = rows.length;
    const authorized = rows.filter((r: { status: string }) => r.status === "autorizada").length;
    const successRate = emitted30d > 0 ? Number(((authorized / emitted30d) * 100).toFixed(1)) : 0;
    const reprocessing = rows.filter(
      (r: { status: string; retries: number }) => r.status === "pendente" && r.retries > 0,
    ).length;
    const rejectedToday = rows.filter(
      (r: { status: string; created_at: string }) =>
        r.status === "rejeitada" && new Date(r.created_at) >= today,
    ).length;

    return { emitted30d, successRate, reprocessing, rejectedToday };
  });

// ─── uploadFiscalCertificate ──────────────────────────────────

const certUploadSchema = z.object({
  fileBase64: z.string().min(1),
  fileName: z.string().regex(/\.(pfx|p12)$/i, "Apenas arquivos .pfx ou .p12"),
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
      .update({ cert_path: storagePath, updated_at: new Date().toISOString() })
      .eq("client_id", clientId);

    if (updateError) throw new Error(updateError.message);

    await logAudit({
      user_id: context.userId,
      client_id: clientId,
      action: "update",
      resource: "fiscal_certificate",
      new_data: { cert_path: storagePath, file_name: data.fileName },
    });

    return { success: true, certPath: storagePath };
  });
