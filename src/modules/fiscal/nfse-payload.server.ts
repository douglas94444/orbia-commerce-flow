import type { FocusNfsePayload } from "@/integrations/focus-nfe";
import { extractShippingFromMetadata, parseCustomerDocumentFromSources } from "./nfe-destinatario.server";
import { validateCnpj, validateCpf } from "./tax-engine.server";

export interface FiscalServiceCatalogRow {
  item_lista_servico: string;
  codigo_tributacao_municipio: string | null;
  aliquota_iss: number;
  descricao: string;
  municipality_code: string | null;
}

export interface NfseFiscalConfig {
  cnpj: string;
  company_name: string;
  state_uf: string | null;
  municipal_registration: string | null;
  municipality_code: string | null;
  iss_retido?: boolean;
  natureza_operacao_nfse?: string | null;
}

export function buildNfsePayloadForOrder(
  fiscal: NfseFiscalConfig,
  order: {
    value_cents: number;
    metadata: Record<string, unknown>;
    external_id?: string;
  },
  service: FiscalServiceCatalogRow,
  focusEnv: string,
  serviceDescription?: string,
): FocusNfsePayload {
  const today = new Date().toISOString().slice(0, 10);
  const shipping = extractShippingFromMetadata(order.metadata);
  const isHomolog = focusEnv !== "producao";

  const doc = parseCustomerDocumentFromSources([
    shipping,
    order.metadata.customer_document,
    order.metadata.buyer,
    order.metadata.customer,
  ]);

  const cpf =
    doc.cpf && (isHomolog || validateCpf(doc.cpf)) ? doc.cpf : isHomolog ? "00000000191" : undefined;
  const cnpj =
    doc.cnpj && (isHomolog || validateCnpj(doc.cnpj)) ? doc.cnpj : undefined;

  const municipio = service.municipality_code ?? fiscal.municipality_code ?? undefined;
  const valorServicos = order.value_cents / 100;
  const discriminacao =
    serviceDescription ??
    `${service.descricao}${order.external_id ? ` — ref. pedido ${order.external_id}` : ""}`;

  return {
    data_emissao: today,
    natureza_operacao: fiscal.natureza_operacao_nfse ?? "Prestação de serviço",
    prestador: {
      cnpj: fiscal.cnpj.replace(/\D/g, ""),
      inscricao_municipal: fiscal.municipal_registration ?? undefined,
      codigo_municipio: municipio,
    },
    tomador: {
      razao_social: shipping.name ?? "Tomador do serviço",
      cpf,
      cnpj,
      email: shipping.email,
      endereco: {
        logradouro: shipping.street ?? (isHomolog ? "Rua Teste" : "N/A"),
        numero: shipping.number ?? (isHomolog ? "100" : "S/N"),
        bairro: shipping.neighborhood ?? (isHomolog ? "Centro" : "N/A"),
        codigo_municipio: shipping.municipalityCode ?? municipio,
        uf: (shipping.state ?? fiscal.state_uf ?? "SP").slice(0, 2).toUpperCase(),
        cep: (shipping.postalCode ?? (isHomolog ? "01310100" : "00000000"))
          .replace(/\D/g, "")
          .slice(0, 8),
      },
    },
    servico: {
      valor_servicos: valorServicos,
      item_lista_servico: service.item_lista_servico,
      discriminacao,
      codigo_municipio: municipio,
      aliquota: Number(service.aliquota_iss),
    },
  };
}
