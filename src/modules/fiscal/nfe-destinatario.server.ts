import type { FocusNfePayload } from "@/integrations/focus-nfe";
import { resolveIbgeByCep } from "./nfe-cep-ibge.server";
import { validateCnpj, validateCpf } from "./tax-engine.server";

export interface OrderShippingMeta {
  name?: string;
  cpf?: string;
  cnpj?: string;
  street?: string;
  number?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  email?: string;
  phone?: string;
  stateRegistration?: string;
  municipalityCode?: string;
}

export function extractShippingFromMetadata(
  metadata: Record<string, unknown>,
): OrderShippingMeta {
  const shipping = (metadata.shipping ?? {}) as OrderShippingMeta;
  return {
    name: shipping.name,
    cpf: shipping.cpf,
    cnpj: shipping.cnpj,
    street: shipping.street,
    number: shipping.number,
    neighborhood: shipping.neighborhood,
    city: shipping.city,
    state: shipping.state,
    postalCode: shipping.postalCode ?? (metadata.postal_code as string | undefined),
    email: shipping.email ?? (metadata.customer_email as string | undefined),
    phone: shipping.phone ?? (metadata.customer_phone as string | undefined),
    stateRegistration: shipping.stateRegistration,
    municipalityCode: shipping.municipalityCode,
  };
}

function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export function parseCustomerDocument(value: unknown): { cpf?: string; cnpj?: string } {
  if (value == null) return {};
  if (typeof value === "string") {
    const digits = onlyDigits(value);
    if (digits.length === 11) return { cpf: digits };
    if (digits.length === 14) return { cnpj: digits };
    return {};
  }
  if (typeof value === "object") {
    const o = value as Record<string, unknown>;
    const cpf = o.cpf ?? o.CPF ?? o.cpf_cnpj;
    const cnpj = o.cnpj ?? o.CNPJ;
    if (cpf) return parseCustomerDocument(String(cpf));
    if (cnpj) return parseCustomerDocument(String(cnpj));
    const doc = o.doc_number ?? o.document ?? o.tax_id ?? o.identification ?? o.buyer_cpf_id;
    if (doc) return parseCustomerDocument(String(doc));
    const billing = o.billing_info as Record<string, unknown> | undefined;
    if (billing?.doc_number) return parseCustomerDocument(String(billing.doc_number));
  }
  return {};
}

export function parseCustomerDocumentFromSources(
  sources: unknown[],
): { cpf?: string; cnpj?: string } {
  for (const src of sources) {
    const doc = parseCustomerDocument(src);
    if (doc.cpf || doc.cnpj) return doc;
  }
  return {};
}

export interface DestinatarioValidationResult {
  ok: boolean;
  errors: string[];
}

export function validateDestinatarioForProduction(
  shipping: OrderShippingMeta,
  focusEnv: string,
): DestinatarioValidationResult {
  if (focusEnv !== "producao") return { ok: true, errors: [] };

  const errors: string[] = [];
  const cpf = shipping.cpf ? onlyDigits(shipping.cpf) : "";
  const cnpj = shipping.cnpj ? onlyDigits(shipping.cnpj) : "";

  if (!cpf && !cnpj) errors.push("CPF ou CNPJ do destinatário obrigatório");
  if (cpf && !validateCpf(cpf)) errors.push("CPF do destinatário inválido");
  if (cnpj && !validateCnpj(cnpj)) errors.push("CNPJ do destinatário inválido");
  if (!shipping.name?.trim()) errors.push("Nome do destinatário obrigatório");
  if (!shipping.street?.trim()) errors.push("Logradouro obrigatório");
  if (!shipping.city?.trim()) errors.push("Município obrigatório");
  if (!shipping.state?.trim() || shipping.state.length < 2) errors.push("UF obrigatória");
  if (!onlyDigits(shipping.postalCode ?? "").slice(0, 8)) errors.push("CEP obrigatório");

  return { ok: errors.length === 0, errors };
}

export async function enrichShippingWithIbge(
  shipping: OrderShippingMeta,
): Promise<OrderShippingMeta> {
  if (shipping.municipalityCode) return shipping;
  const cep = shipping.postalCode;
  if (!cep) return shipping;
  const ibge = await resolveIbgeByCep(cep);
  return ibge ? { ...shipping, municipalityCode: ibge } : shipping;
}

export async function applyDestinatarioToPayload(
  payload: FocusNfePayload,
  shipping: OrderShippingMeta,
  focusEnv: string,
): Promise<FocusNfePayload> {
  const isHomolog = focusEnv !== "producao";
  const enriched = await enrichShippingWithIbge(shipping);

  const cpf = enriched.cpf ? onlyDigits(enriched.cpf) : undefined;
  const cnpj = enriched.cnpj ? onlyDigits(enriched.cnpj) : undefined;

  const result: FocusNfePayload = {
    ...payload,
    nome_destinatario: (enriched.name ?? payload.nome_destinatario).slice(0, 60),
    logradouro_destinatario: (enriched.street ?? payload.logradouro_destinatario).slice(0, 60),
    numero_destinatario: (enriched.number ?? payload.numero_destinatario).slice(0, 10),
    bairro_destinatario: (enriched.neighborhood ?? payload.bairro_destinatario).slice(0, 60),
    municipio_destinatario: (enriched.city ?? payload.municipio_destinatario).slice(0, 60),
    uf_destinatario: (enriched.state ?? payload.uf_destinatario).slice(0, 2).toUpperCase(),
    cep_destinatario: onlyDigits(enriched.postalCode ?? payload.cep_destinatario).slice(0, 8),
  };

  if (enriched.municipalityCode) {
    result.codigo_municipio_destinatario = enriched.municipalityCode;
  }
  if (enriched.email) result.email_destinatario = enriched.email.slice(0, 60);
  if (enriched.phone) result.telefone_destinatario = onlyDigits(enriched.phone).slice(0, 14);

  if (isHomolog && !cpf && !cnpj) {
    result.cpf_destinatario = result.cpf_destinatario ?? "00000000191";
    return result;
  }

  if (cpf && cpf.length === 11) {
    result.cpf_destinatario = cpf;
    result.indicador_inscricao_estadual_destinatario = "9";
  }
  if (cnpj && cnpj.length === 14) {
    result.cnpj_destinatario = cnpj;
    result.cpf_destinatario = undefined;
    const ie = enriched.stateRegistration?.trim();
    if (ie && ie.toUpperCase() !== "ISENTO") {
      result.inscricao_estadual_destinatario = ie;
      result.indicador_inscricao_estadual_destinatario = "1";
    } else {
      result.indicador_inscricao_estadual_destinatario = "9";
    }
  }

  return result;
}
