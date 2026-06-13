import { PLAN_LABELS, PLAN_PRICES_CENTS, type PlanTier } from "@/shared/constants/plans";

export interface ContractClauses {
  scope: string[];
  sla: string;
  merchantResponsibilities: string[];
  cancellationPolicy: string;
  confidentiality: string;
  lgpd: string;
  customClauses?: string[];
}

export function buildContractClauses(plan: PlanTier): ContractClauses {
  return {
    scope: [
      `Gestão do plano ${PLAN_LABELS[plan]} conforme escopo comercial`,
      "Monitoramento de tráfego Meta e Google Ads",
      "Operação logística omnichannel via Fulfillly",
      "Emissão fiscal integrada (NF-e)",
      "Automações de retenção e relatórios mensais",
      "Customer Success dedicado com QBR trimestral",
    ],
    sla: "SLA de despacho de 24h úteis para pedidos pagos até 14h (exceto feriados). Penalidade proporcional em caso de descumprimento recorrente.",
    merchantResponsibilities: [
      "Manter catálogo e estoque atualizados",
      "Fornecer certificado digital A1 para emissão fiscal",
      "Responder demandas críticas em até 48h úteis",
      "Garantir veracidade das informações cadastrais",
    ],
    cancellationPolicy:
      "Cancelamento com aviso prévio de 30 dias após o período mínimo de 3 meses. Mensalidades já faturadas não são reembolsáveis.",
    confidentiality:
      "As partes comprometem-se a manter sigilo sobre dados comerciais, financeiros e operacionais trocados durante a vigência e por 2 anos após o término.",
    lgpd: "Orbia atua como operadora de dados conforme LGPD (Lei 13.709/2018), processando dados de clientes finais do lojista apenas conforme instruções documentadas.",
  };
}

export function buildContractHtml(
  companyName: string,
  contactName: string,
  plan: PlanTier,
  monthlyCents: number,
  clauses: ContractClauses,
): string {
  const scopeList = clauses.scope.map((s) => `<li>${s}</li>`).join("");
  const respList = clauses.merchantResponsibilities.map((s) => `<li>${s}</li>`).join("");
  const custom = (clauses.customClauses ?? []).map((s) => `<p>${s}</p>`).join("");

  return `
    <h1>Contrato de Prestação de Serviços</h1>
    <p><strong>Contratante:</strong> ${companyName} — ${contactName}</p>
    <p><strong>Contratada:</strong> Orbia Commerce Flow</p>
    <p><strong>Plano:</strong> ${PLAN_LABELS[plan]} — R$ ${(monthlyCents / 100).toLocaleString("pt-BR")}/mês</p>
    <h2>1. Escopo</h2><ul>${scopeList}</ul>
    <h2>2. SLA</h2><p>${clauses.sla}</p>
    <h2>3. Responsabilidades do lojista</h2><ul>${respList}</ul>
    <h2>4. Cancelamento</h2><p>${clauses.cancellationPolicy}</p>
    <h2>5. Confidencialidade</h2><p>${clauses.confidentiality}</p>
    <h2>6. Proteção de dados (LGPD)</h2><p>${clauses.lgpd}</p>
    ${custom}
  `;
}

export function defaultMonthlyCents(plan: PlanTier): number {
  return PLAN_PRICES_CENTS[plan];
}
