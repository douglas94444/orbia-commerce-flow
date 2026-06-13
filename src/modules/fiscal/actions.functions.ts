import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logAudit } from "@/shared/lib/logger";
import type { NfEmission, NfStatus } from "@/shared/types/orbia";
import { canCancelWithinWindow } from "./fiscal-ops.server";
import { validateCnpj } from "./tax-engine.server";
import { encryptCertPassword, parsePfxExpiry } from "./fiscal-cert.server";
import { syncFiscalConfigToFocus } from "./focus-empresa-sync.server";

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
  series?: string | null;
  number?: number | null;
  webhook_received_at?: string | null;
  metadata?: Record<string, unknown> | null;
  clients: { name: string } | null;
}): NfEmission {
  const created = new Date(row.created_at);
  const meta = (row.metadata ?? {}) as Record<string, unknown>;
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
    series: row.series ?? null,
    number: row.number ?? null,
    webhookReceivedAt: row.webhook_received_at ?? null,
    qrCodeUrl: (meta.qr_code_url as string) ?? row.danfe_url ?? null,
  };
}

// ─── listNfEmissions ──────────────────────────────────────────

export const listNfEmissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<NfEmission[]> => {
    const { data, error } = await context.supabase
      .from("nfe_emissions")
      .select(
        "id, type, status, value_cents, retries, created_at, access_key, last_error, danfe_url, xml_url, order_id, external_ref, authorized_at, series, number, webhook_received_at, metadata, clients(name)",
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
        "id, type, status, value_cents, retries, created_at, access_key, last_error, danfe_url, xml_url, order_id, external_ref, authorized_at, series, number, webhook_received_at, metadata, clients(name)",
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
  stateUf: string;
  stateRegistration: string | null;
  municipalRegistration: string | null;
  municipalityCode: string | null;
  defaultCfop: string | null;
  defaultCst: string | null;
  defaultNcm: string | null;
  certExpiresAt: string | null;
  certPath: string | null;
  hasCertPassword: boolean;
  certExpiringSoon: boolean;
  focusSyncedAt: string | null;
  autoEmitNfe: boolean;
  autoEmitNfce: boolean;
  autoEmitNfse: boolean;
  nfceCscId: string | null;
  nfceCscToken: string | null;
  issRetido: boolean;
  naturezaOperacaoNfse: string | null;
  focusEnvironment: string;
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
        "id, cnpj, company_name, tax_regime, state_uf, state_registration, municipal_registration, municipality_code, default_cfop, default_cst, default_ncm, cert_expires_at, cert_path, cert_password, focus_synced_at, auto_emit_nfe, auto_emit_nfce, auto_emit_nfse, nfce_csc_id, nfce_csc_token, iss_retido, natureza_operacao_nfse, focus_environment",
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
      stateUf: data.state_uf ?? "SP",
      stateRegistration: data.state_registration,
      municipalRegistration: data.municipal_registration,
      municipalityCode: data.municipality_code,
      defaultCfop: data.default_cfop,
      defaultCst: data.default_cst,
      defaultNcm: data.default_ncm,
      certExpiresAt: data.cert_expires_at,
      certPath: data.cert_path,
      hasCertPassword: Boolean(data.cert_password),
      certExpiringSoon,
      focusSyncedAt: data.focus_synced_at,
      autoEmitNfe: data.auto_emit_nfe ?? true,
      autoEmitNfce: data.auto_emit_nfce ?? false,
      autoEmitNfse: data.auto_emit_nfse ?? false,
      nfceCscId: data.nfce_csc_id,
      nfceCscToken: data.nfce_csc_token,
      issRetido: data.iss_retido ?? false,
      naturezaOperacaoNfse: data.natureza_operacao_nfse,
      focusEnvironment: (data as { focus_environment?: string }).focus_environment ?? "homologacao",
    };
  });

// ─── upsertFiscalConfig ───────────────────────────────────────

const fiscalConfigSchema = z.object({
  cnpj: z
    .string()
    .regex(/^\d{14}$/, "CNPJ deve ter 14 dígitos sem pontuação")
    .refine(validateCnpj, "CNPJ inválido (dígitos verificadores)"),
  companyName: z.string().min(2).max(150),
  taxRegime: z.enum(["simples", "lucro_presumido", "lucro_real"]),
  stateUf: z.string().length(2).optional(),
  stateRegistration: z.string().min(1).max(20),
  municipalRegistration: z.string().max(20).optional().nullable(),
  municipalityCode: z.string().max(10).optional().nullable(),
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
          state_uf: data.stateUf?.toUpperCase() ?? "SP",
          state_registration: data.stateRegistration,
          municipal_registration: data.municipalRegistration ?? null,
          municipality_code: data.municipalityCode ?? null,
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

    try {
      await syncFiscalConfigToFocus(clientId);
    } catch (err) {
      console.warn("[fiscal] Focus sync após save falhou:", (err as Error).message);
    }

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
  configIncomplete: boolean;
  rejectionReasons: Array<{ reason: string; count: number }>;
  nfsePending: number;
  nfceCount30d: number;
  nfseCount30d: number;
}

export const getFiscalStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FiscalStats> => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [{ data: rows }, { data: config }, readiness] = await Promise.all([
      context.supabase
        .from("nfe_emissions")
        .select("status, retries, created_at, last_error, type")
        .gte("created_at", thirtyDaysAgo),
      context.supabase
        .from("fiscal_configs")
        .select("cert_path, cert_expires_at, client_id")
        .maybeSingle(),
      (async () => {
        const { data: member } = await context.supabase
          .from("client_members")
          .select("client_id")
          .eq("user_id", context.userId)
          .eq("status", "active")
          .maybeSingle();
        if (!member) return { ready: false };
        const { validateFiscalReadiness } = await import("./fiscal-readiness.server");
        return validateFiscalReadiness(member.client_id);
      })(),
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
      configIncomplete: !readiness.ready,
      rejectionReasons,
      nfsePending: emissions.filter((r) => r.type === "NFS-e" && r.status === "pendente").length,
      nfceCount30d: emissions.filter((r) => r.type === "NFC-e").length,
      nfseCount30d: emissions.filter((r) => r.type === "NFS-e").length,
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

    const encryptedPassword = data.certPassword ? encryptCertPassword(data.certPassword) : null;
    let certExpiresAt = data.certExpiresAt ?? null;
    if (data.certPassword) {
      const parsed = await parsePfxExpiry(buffer, data.certPassword);
      if (parsed) certExpiresAt = parsed;
    }

    const { error: updateError } = await supabaseAdmin
      .from("fiscal_configs")
      .update({
        cert_path: storagePath,
        cert_password: encryptedPassword,
        cert_expires_at: certExpiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq("client_id", clientId);

    if (updateError) throw new Error(updateError.message);

    try {
      await syncFiscalConfigToFocus(clientId);
    } catch (err) {
      console.warn("[fiscal] Focus sync após upload falhou:", (err as Error).message);
    }

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

// ─── cartaCorrecaoNfeFn ───────────────────────────────────────

export const cartaCorrecaoNfeFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      emissionId: z.string().uuid(),
      correcao: z.string().min(15).max(1000),
    }),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { cartaCorrecaoNfeEmission } = await import("./fiscal-ops.server");
    await cartaCorrecaoNfeEmission(data.emissionId, data.correcao);
    await logAudit({
      user_id: context.userId,
      action: "nfe_cce",
      resource: "nfe_emission",
      resource_id: data.emissionId,
    });
    return { success: true };
  });

// ─── inutilizarNumeracaoFn ──────────────────────────────────────

export const inutilizarNumeracaoFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      serie: z.string().min(1).max(3),
      numeroInicial: z.number().int().positive(),
      numeroFinal: z.number().int().positive(),
      justificativa: z.string().min(15).max(255),
    }),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { data: member } = await context.supabase
      .from("client_members")
      .select("client_id")
      .eq("user_id", context.userId)
      .eq("status", "active")
      .single();

    if (!member) throw new Error("Nenhum cliente associado a este usuário.");

    const { inutilizarNumeracaoFiscal } = await import("./fiscal-ops.server");
    await inutilizarNumeracaoFiscal({
      clientId: member.client_id,
      serie: data.serie,
      numeroInicial: data.numeroInicial,
      numeroFinal: data.numeroFinal,
      justificativa: data.justificativa,
    });

    await logAudit({
      user_id: context.userId,
      client_id: member.client_id,
      action: "nfe_inutilizacao",
      resource: "fiscal_config",
      new_data: data,
    });

    return { success: true };
  });

// ─── emitNfceForOrderFn / emitNfseForOrderFn ───────────────────

export const emitNfceForOrderFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ orderId: z.string().uuid() }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { emitNfceForOrder } = await import("./emit-nfce.server");
    const emissionId = await emitNfceForOrder(data.orderId);
    await logAudit({
      user_id: context.userId,
      action: "nfce_emit",
      resource: "nfe_emission",
      resource_id: emissionId,
    });
    return { success: true, emissionId };
  });

export const emitNfseForOrderFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      orderId: z.string().uuid(),
      serviceDescription: z.string().max(500).optional(),
    }),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { emitNfseForOrder } = await import("./emit-nfse.server");
    const emissionId = await emitNfseForOrder(data.orderId, data.serviceDescription);
    await logAudit({
      user_id: context.userId,
      action: "nfse_emit",
      resource: "nfe_emission",
      resource_id: emissionId,
    });
    return { success: true, emissionId };
  });

// ─── getFiscalReadiness ───────────────────────────────────────

export const getFiscalReadiness = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: member } = await context.supabase
      .from("client_members")
      .select("client_id")
      .eq("user_id", context.userId)
      .eq("status", "active")
      .single();

    if (!member) throw new Error("Nenhum cliente associado a este usuário.");

    const { validateFiscalReadiness } = await import("./fiscal-readiness.server");
    return validateFiscalReadiness(member.client_id);
  });

// ─── emitNfeForOrderFn ────────────────────────────────────────

export const emitNfeForOrderFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ orderId: z.string().uuid() }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { emitNfeForOrder } = await import("./emit-order-nfe.server");
    await emitNfeForOrder(data.orderId);
    await logAudit({
      user_id: context.userId,
      action: "nfe_emit_manual",
      resource: "order",
      resource_id: data.orderId,
    });
    return { success: true };
  });

// ─── listOrdersAwaitingNf ─────────────────────────────────────

export interface OrderAwaitingNfRow {
  id: string;
  externalId: string;
  channel: string;
  valueCents: number;
  nfStatus: string;
  status: string;
  createdAt: string;
  lastError: string | null;
}

export const listOrdersAwaitingNf = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<OrderAwaitingNfRow[]> => {
    const { data, error } = await context.supabase
      .from("orders")
      .select("id, external_id, channel, value_cents, nf_status, status, created_at, metadata")
      .in("nf_status", ["pendente", "rejeitada"])
      .in("status", ["aguardando_nf", "separacao"])
      .order("created_at", { ascending: false })
      .limit(30);

    if (error) throw new Error(error.message);

    return (data ?? []).map((r) => {
      const meta = (r.metadata ?? {}) as Record<string, unknown>;
      return {
        id: r.id,
        externalId: r.external_id,
        channel: r.channel,
        valueCents: r.value_cents,
        nfStatus: r.nf_status,
        status: r.status,
        createdAt: r.created_at,
        lastError: (meta.last_nfe_error as string) ?? null,
      };
    });
  });

// ─── getNfeXmlDownloadUrl ─────────────────────────────────────

export const getNfeXmlDownloadUrl = createServerFn({ method: "GET" })
  .inputValidator(z.object({ emissionId: z.string().uuid() }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("nfe_emissions")
      .select("xml_storage_path, xml_url")
      .eq("id", data.emissionId)
      .single();

    if (error || !row) throw new Error("Emissão não encontrada");

    const storagePath = row.xml_storage_path as string | null;
    if (storagePath) {
      const { createNfeXmlSignedUrl } = await import("./nfe-storage.server");
      const signed = await createNfeXmlSignedUrl(storagePath);
      return { url: signed };
    }

    return { url: row.xml_url as string | null };
  });

// ─── listNfeFiscalEventsFn ────────────────────────────────────

export const listNfeFiscalEventsFn = createServerFn({ method: "GET" })
  .inputValidator(z.object({ emissionId: z.string().uuid() }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data }) => {
    const { listNfeFiscalEvents } = await import("./nfe-fiscal-events.server");
    return listNfeFiscalEvents(data.emissionId);
  });

// ─── Fiscal series & auto-emit ────────────────────────────────

export const listFiscalSeriesFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: member } = await context.supabase
      .from("client_members")
      .select("client_id")
      .eq("user_id", context.userId)
      .eq("status", "active")
      .single();
    if (!member) throw new Error("Cliente não encontrado");
    const { listFiscalSeries } = await import("./fiscal-series.server");
    return listFiscalSeries(member.client_id);
  });

export const upsertFiscalSeriesFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      docType: z.enum(["nfe", "nfce", "nfse"]),
      serie: z.string().min(1).max(3),
      lastNumber: z.number().int().min(0),
      environment: z.string().min(1),
    }),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { data: member } = await context.supabase
      .from("client_members")
      .select("client_id")
      .eq("user_id", context.userId)
      .eq("status", "active")
      .single();
    if (!member) throw new Error("Cliente não encontrado");
    const { upsertFiscalSeries } = await import("./fiscal-series.server");
    await upsertFiscalSeries({
      clientId: member.client_id,
      docType: data.docType,
      serie: data.serie,
      lastNumber: data.lastNumber,
      environment: data.environment,
    });
    return { success: true };
  });

export const updateFiscalAutoEmitFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      autoEmitNfe: z.boolean().optional(),
      autoEmitNfce: z.boolean().optional(),
      autoEmitNfse: z.boolean().optional(),
      nfceCscId: z.string().max(20).optional().nullable(),
      nfceCscToken: z.string().max(100).optional().nullable(),
      issRetido: z.boolean().optional(),
      naturezaOperacaoNfse: z.string().max(100).optional().nullable(),
      focusEnvironment: z.enum(["homologacao", "producao"]).optional(),
    }),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { data: member } = await context.supabase
      .from("client_members")
      .select("client_id")
      .eq("user_id", context.userId)
      .eq("status", "active")
      .single();
    if (!member) throw new Error("Cliente não encontrado");

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.autoEmitNfe !== undefined) patch.auto_emit_nfe = data.autoEmitNfe;
    if (data.autoEmitNfce !== undefined) patch.auto_emit_nfce = data.autoEmitNfce;
    if (data.autoEmitNfse !== undefined) patch.auto_emit_nfse = data.autoEmitNfse;
    if (data.nfceCscId !== undefined) patch.nfce_csc_id = data.nfceCscId;
    if (data.nfceCscToken !== undefined) patch.nfce_csc_token = data.nfceCscToken;
    if (data.issRetido !== undefined) patch.iss_retido = data.issRetido;
    if (data.naturezaOperacaoNfse !== undefined) {
      patch.natureza_operacao_nfse = data.naturezaOperacaoNfse;
    }
    if (data.focusEnvironment !== undefined) {
      patch.focus_environment = data.focusEnvironment;
    }

    const { error } = await supabaseAdmin
      .from("fiscal_configs")
      .update(patch)
      .eq("client_id", member.client_id);
    if (error) throw new Error(error.message);

    if (data.nfceCscId !== undefined || data.nfceCscToken !== undefined) {
      await supabaseAdmin.from("fiscal_nfce_settings").upsert(
        {
          client_id: member.client_id,
          csc_id: data.nfceCscId ?? null,
          csc_token: data.nfceCscToken ?? null,
        },
        { onConflict: "client_id" },
      );
    }

    return { success: true };
  });

// ─── Fiscal service catalog ───────────────────────────────────

export interface FiscalServiceRow {
  id: string;
  itemListaServico: string;
  codigoTributacaoMunicipio: string | null;
  aliquotaIss: number;
  descricao: string;
  municipalityCode: string | null;
  isDefault: boolean;
}

export const listFiscalServicesFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FiscalServiceRow[]> => {
    const { data, error } = await context.supabase
      .from("fiscal_service_catalog")
      .select(
        "id, item_lista_servico, codigo_tributacao_municipio, aliquota_iss, descricao, municipality_code, is_default",
      )
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => ({
      id: r.id,
      itemListaServico: r.item_lista_servico,
      codigoTributacaoMunicipio: r.codigo_tributacao_municipio,
      aliquotaIss: Number(r.aliquota_iss),
      descricao: r.descricao,
      municipalityCode: r.municipality_code,
      isDefault: r.is_default,
    }));
  });

export const upsertFiscalServiceFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      id: z.string().uuid().optional(),
      itemListaServico: z.string().min(1).max(20),
      codigoTributacaoMunicipio: z.string().max(30).optional().nullable(),
      aliquotaIss: z.number().min(0).max(100),
      descricao: z.string().min(2).max(200),
      municipalityCode: z.string().max(10).optional().nullable(),
      isDefault: z.boolean().optional(),
    }),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { data: member } = await context.supabase
      .from("client_members")
      .select("client_id")
      .eq("user_id", context.userId)
      .eq("status", "active")
      .single();
    if (!member) throw new Error("Cliente não encontrado");

    if (data.isDefault) {
      await supabaseAdmin
        .from("fiscal_service_catalog")
        .update({ is_default: false })
        .eq("client_id", member.client_id);
    }

    const row = {
      client_id: member.client_id,
      item_lista_servico: data.itemListaServico,
      codigo_tributacao_municipio: data.codigoTributacaoMunicipio ?? null,
      aliquota_iss: data.aliquotaIss,
      descricao: data.descricao,
      municipality_code: data.municipalityCode ?? null,
      is_default: data.isDefault ?? false,
      updated_at: new Date().toISOString(),
    };

    if (data.id) {
      const { error } = await supabaseAdmin
        .from("fiscal_service_catalog")
        .update(row)
        .eq("id", data.id)
        .eq("client_id", member.client_id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }

    const { data: inserted, error } = await supabaseAdmin
      .from("fiscal_service_catalog")
      .insert(row)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: inserted.id };
  });

export const deleteFiscalServiceFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string().uuid() }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("fiscal_service_catalog")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { success: true };
  });

// ─── Fiscal metrics & tax rules ───────────────────────────────

export const getFiscalMetricsFn = createServerFn({ method: "GET" })
  .inputValidator(z.object({ days: z.number().optional() }).optional())
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { data: member } = await context.supabase
      .from("client_members")
      .select("client_id")
      .eq("user_id", context.userId)
      .eq("status", "active")
      .single();
    if (!member) throw new Error("Cliente não encontrado");
    const { getFiscalMetrics } = await import("./fiscal-metrics.server");
    return getFiscalMetrics(member.client_id, data?.days ?? 30);
  });

export const importTaxRulesFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ csv: z.string().min(10) }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { data: member } = await context.supabase
      .from("client_members")
      .select("client_id")
      .eq("user_id", context.userId)
      .eq("status", "active")
      .single();
    if (!member) throw new Error("Cliente não encontrado");
    const { importTaxRulesFromCsv } = await import("./fiscal-metrics.server");
    return importTaxRulesFromCsv(member.client_id, data.csv);
  });

export const sendNfSecondCopyFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      emissionId: z.string().uuid(),
      phone: z.string().optional(),
      email: z.string().email().optional(),
    }),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("nfe_emissions")
      .select("id, type, status, danfe_url, xml_storage_path, xml_url, order_id")
      .eq("id", data.emissionId)
      .single();
    if (error || !row) throw new Error("Emissão não encontrada");
    if (row.status !== "autorizada") throw new Error("NF ainda não autorizada");

    let url = row.danfe_url as string | null;
    if (row.xml_storage_path) {
      const { createNfeXmlSignedUrl } = await import("./nfe-storage.server");
      url = (await createNfeXmlSignedUrl(row.xml_storage_path as string)) ?? url;
    } else if (row.xml_url) {
      url = row.xml_url as string;
    }
    if (!url) throw new Error("Documento indisponível");

    if (data.phone) {
      const { data: member } = await context.supabase
        .from("client_members")
        .select("client_id")
        .eq("user_id", context.userId)
        .eq("status", "active")
        .single();
      const { sendWhatsAppMessage } = await import("@/integrations/whatsapp");
      const { getWhatsAppCredentials } = await import("@/integrations/whatsapp/provider");
      const creds = member ? await getWhatsAppCredentials(member.client_id) : null;
      if (creds?.provider === "meta") {
        await sendWhatsAppMessage({
          phoneNumberId: creds.phoneNumberId,
          accessToken: creds.accessToken,
          to: data.phone,
          body: `Segunda via ${row.type}: ${url}`,
          clientId: member!.client_id,
          documentUrl: url,
        });
      }
    }

    return { url, type: row.type };
  });

// ─── Search / ZIP / Onboarding / Portal / Returns ─────────────

export const searchNfEmissionsFn = createServerFn({ method: "GET" })
  .inputValidator(
    z
      .object({
        accessKey: z.string().optional(),
        orderId: z.string().uuid().optional(),
        cpfCnpj: z.string().optional(),
        days: z.number().optional(),
        type: z.enum(["NF-e", "NFC-e", "NFS-e"]).optional(),
      })
      .optional(),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }): Promise<NfEmission[]> => {
    const days = data?.days ?? 90;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    let query = context.supabase
      .from("nfe_emissions")
      .select(
        "id, type, status, value_cents, retries, created_at, access_key, last_error, danfe_url, xml_url, order_id, external_ref, authorized_at, series, number, webhook_received_at, metadata, clients(name)",
      )
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(50);

    if (data?.accessKey) query = query.ilike("access_key", `%${data.accessKey.replace(/\D/g, "")}%`);
    if (data?.orderId) query = query.eq("order_id", data.orderId);
    if (data?.type) query = query.eq("type", data.type);

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    let results = (rows ?? []).map((row) =>
      mapEmissionRow(row as Parameters<typeof mapEmissionRow>[0]),
    );

    if (data?.cpfCnpj) {
      const doc = data.cpfCnpj.replace(/\D/g, "");
      const { data: orders } = await context.supabase
        .from("orders")
        .select("id, metadata")
        .gte("created_at", since);
      const orderIds = new Set(
        (orders ?? [])
          .filter((o) => {
            const meta = JSON.stringify(o.metadata ?? {});
            return meta.includes(doc);
          })
          .map((o) => o.id),
      );
      results = results.filter((r) => r.orderId && orderIds.has(r.orderId));
    }

    return results;
  });

export const exportNfePeriodZipFn = createServerFn({ method: "GET" })
  .inputValidator(z.object({ days: z.number().optional() }).optional())
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const days = data?.days ?? 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const { data: rows, error } = await context.supabase
      .from("nfe_emissions")
      .select("id, external_ref, xml_storage_path, xml_url, access_key, type, created_at")
      .eq("status", "autorizada")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw new Error(error.message);

    const { createNfeXmlSignedUrl } = await import("./nfe-storage.server");
    const files: Array<{ name: string; url: string }> = [];

    for (const row of rows ?? []) {
      let url = row.xml_url as string | null;
      if (row.xml_storage_path) {
        url = await createNfeXmlSignedUrl(row.xml_storage_path as string);
      }
      if (!url) continue;
      const name = `${row.type}-${row.access_key ?? row.external_ref ?? row.id}.xml`;
      files.push({ name, url });
    }

    return { files, count: files.length, periodDays: days };
  });

export const getFiscalOnboardingChecklistFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: member } = await context.supabase
      .from("client_members")
      .select("client_id")
      .eq("user_id", context.userId)
      .eq("status", "active")
      .single();
    if (!member) throw new Error("Cliente não encontrado");
    const { getFiscalOnboardingChecklist } = await import("./fiscal-onboarding.server");
    return getFiscalOnboardingChecklist(member.client_id);
  });

export const getReturnFiscalStatusFn = createServerFn({ method: "GET" })
  .inputValidator(z.object({ returnRequestId: z.string().uuid() }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { data: req } = await context.supabase
      .from("return_requests")
      .select("id, order_id, status")
      .eq("id", data.returnRequestId)
      .single();

    if (!req?.order_id) return { saleNfe: null, returnNfe: null };

    const { data: emissions } = await context.supabase
      .from("nfe_emissions")
      .select("id, type, status, access_key, authorized_at, last_error, external_ref")
      .eq("order_id", req.order_id)
      .order("created_at", { ascending: false });

    const saleNfe = (emissions ?? []).find(
      (e) => e.type === "NF-e" && e.status === "autorizada",
    );
    const returnNfe = (emissions ?? []).find(
      (e) =>
        e.type === "NF-e" &&
        (e.external_ref as string | null)?.includes("dev") &&
        e.status !== "cancelada",
    );

    return {
      returnStatus: req.status,
      saleNfe: saleNfe
        ? {
            id: saleNfe.id,
            accessKey: saleNfe.access_key,
            status: saleNfe.status,
            authorizedAt: saleNfe.authorized_at,
          }
        : null,
      returnNfe: returnNfe
        ? {
            id: returnNfe.id,
            accessKey: returnNfe.access_key,
            status: returnNfe.status,
            lastError: returnNfe.last_error,
            authorizedAt: returnNfe.authorized_at,
          }
        : null,
    };
  });

export const getFiscalAccountantExportFn = createServerFn({ method: "GET" })
  .inputValidator(z.object({ days: z.number().optional() }).optional())
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const days = data?.days ?? 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const { data: rows, error } = await context.supabase
      .from("nfe_emissions")
      .select("id, type, status, value_cents, access_key, created_at, authorized_at, series, number")
      .eq("status", "autorizada")
      .gte("created_at", since)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    const header = "id,tipo,serie,numero,valor_cents,chave,criado_em,autorizado_em";
    const lines = (rows ?? []).map((r) =>
      [
        r.id,
        r.type,
        r.series ?? "",
        r.number ?? "",
        r.value_cents,
        r.access_key ?? "",
        r.created_at,
        r.authorized_at ?? "",
      ].join(","),
    );

    return {
      csv: [header, ...lines].join("\n"),
      filename: `fiscal-contador-${days}d.csv`,
      count: rows?.length ?? 0,
    };
  });
