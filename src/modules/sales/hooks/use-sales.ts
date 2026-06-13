import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  addProspectInteraction,
  assignProspect,
  completeProspectTask,
  createProspectStaff,
  createProspectTask,
  getProspect,
  getSalesFunnelMetrics,
  listPipelineStages,
  listProspects,
  listRecentProspectEvents,
  listSalesStaff,
  moveProspectStage,
} from "../actions.functions";
import {
  activatePartner,
  createContract,
  createProposal,
  enrollColdNurtureFn,
  getCommercialOnboardingFn,
  getPartnerDashboardFn,
  getPartnerRankingFn,
  getProspectMetaDiagnostics,
  getSalesMetrics,
  listPartners,
  listUpsellOpportunitiesFn,
  runUpsellScan,
} from "../proposals.actions.functions";
import {
  confirmTripwirePayment,
  getDiagnosticPdf,
  getDiagnosticResult,
  getPublicContract,
  getPublicProposal,
  registerPartnerPublic,
  signContractPublic,
  startTripwireCheckout,
  submitDiagnosticForm,
  trackProposalSection,
  trackProspectEvent,
} from "../public.functions";

const salesKeys = {
  all: ["sales"] as const,
  prospects: (filters?: Record<string, unknown>) => ["sales", "prospects", filters] as const,
  prospect: (id: string) => ["sales", "prospect", id] as const,
  stages: ["sales", "stages"] as const,
  staff: ["sales", "staff"] as const,
  funnel: ["sales", "funnel"] as const,
  events: ["sales", "events"] as const,
  metrics: ["sales", "metrics"] as const,
  partners: ["sales", "partners"] as const,
  upsell: ["sales", "upsell"] as const,
  diagnosis: (token: string) => ["sales", "diagnosis", token] as const,
  proposal: (token: string) => ["sales", "proposal", token] as const,
  contract: (token: string) => ["sales", "contract", token] as const,
};

export function usePipelineStages() {
  return useQuery({ queryKey: salesKeys.stages, queryFn: () => listPipelineStages() });
}

export function useProspects(filters?: {
  stageId?: string;
  source?: string;
  temperature?: "cold" | "warm" | "hot";
  assignedStaffId?: string;
  search?: string;
}) {
  return useQuery({
    queryKey: salesKeys.prospects(filters),
    queryFn: () => listProspects({ data: filters }),
    refetchInterval: 30_000,
  });
}

export function useProspect(prospectId: string) {
  return useQuery({
    queryKey: salesKeys.prospect(prospectId),
    queryFn: () => getProspect({ data: { prospectId } }),
    enabled: !!prospectId,
  });
}

export function useSalesStaff() {
  return useQuery({ queryKey: salesKeys.staff, queryFn: () => listSalesStaff() });
}

export function useSalesFunnel() {
  return useQuery({ queryKey: salesKeys.funnel, queryFn: () => getSalesFunnelMetrics() });
}

export function useRecentProspectEvents() {
  return useQuery({
    queryKey: salesKeys.events,
    queryFn: () => listRecentProspectEvents(),
    refetchInterval: 15_000,
  });
}

export function useCreateProspect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof createProspectStaff>[0]["data"]) =>
      createProspectStaff({ data: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: salesKeys.all });
      toast.success("Prospect criado.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useMoveProspectStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { prospectId: string; stageKey: string; notes?: string }) =>
      moveProspectStage({ data: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: salesKeys.all });
      toast.success("Estágio atualizado.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useAssignProspect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { prospectId: string; staffId: string; notes?: string }) =>
      assignProspect({ data: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: salesKeys.all });
      toast.success("Prospect atribuído.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useAddInteraction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      prospectId: string;
      kind: "email" | "call" | "meeting" | "note" | "proposal_sent" | "objection";
      channel?: string;
      notes?: string;
    }) => addProspectInteraction({ data: input }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: salesKeys.prospect(vars.prospectId) });
      toast.success("Interação registrada.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      prospectId: string;
      title: string;
      dueAt: string;
      priority?: "low" | "normal" | "high" | "urgent";
    }) => createProspectTask({ data: input }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: salesKeys.prospect(vars.prospectId) });
      toast.success("Tarefa criada.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCompleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) => completeProspectTask({ data: { taskId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: salesKeys.all });
    },
  });
}

export function useCreateProposal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { prospectId: string; validDays?: number }) =>
      createProposal({ data: input }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: salesKeys.all });
      toast.success(`Proposta enviada. Link: /proposta/${res.publicToken}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCreateContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      prospectId: string;
      proposalId?: string;
      plan?: "launch" | "growth" | "scale";
    }) => createContract({ data: input }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: salesKeys.all });
      toast.success(`Contrato criado. Link: /contrato/${res.publicToken}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSalesMetrics() {
  return useQuery({ queryKey: salesKeys.metrics, queryFn: () => getSalesMetrics() });
}

export function usePartners() {
  return useQuery({ queryKey: salesKeys.partners, queryFn: () => listPartners() });
}

export function usePartnerRanking() {
  return useQuery({ queryKey: [...salesKeys.partners, "ranking"], queryFn: () => getPartnerRankingFn() });
}

export function usePartnerDashboard(partnerId: string) {
  return useQuery({
    queryKey: [...salesKeys.partners, partnerId],
    queryFn: () => getPartnerDashboardFn({ data: { partnerId } }),
    enabled: !!partnerId,
  });
}

export function useActivatePartner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (partnerId: string) => activatePartner({ data: { partnerId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: salesKeys.partners });
      toast.success("Parceiro ativado.");
    },
  });
}

export function useUpsellOpportunities() {
  return useQuery({ queryKey: salesKeys.upsell, queryFn: () => listUpsellOpportunitiesFn() });
}

export function useRunUpsellScan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => runUpsellScan(),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: salesKeys.upsell });
      toast.success(`${res.created} oportunidades identificadas.`);
    },
  });
}

export function useSubmitDiagnostic() {
  return useMutation({
    mutationFn: (input: Parameters<typeof submitDiagnosticForm>[0]["data"]) =>
      submitDiagnosticForm({ data: input }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDiagnosticResult(token: string) {
  return useQuery({
    queryKey: salesKeys.diagnosis(token),
    queryFn: () => getDiagnosticResult({ data: { token } }),
    enabled: !!token,
  });
}

export function usePublicProposal(token: string) {
  return useQuery({
    queryKey: salesKeys.proposal(token),
    queryFn: () => getPublicProposal({ data: { token } }),
    enabled: !!token,
  });
}

export function usePublicContract(token: string) {
  return useQuery({
    queryKey: salesKeys.contract(token),
    queryFn: () => getPublicContract({ data: { token } }),
    enabled: !!token,
  });
}

export function useSignContract() {
  return useMutation({
    mutationFn: (input: { token: string; signerName: string; signerEmail: string }) =>
      signContractPublic({ data: input }),
    onSuccess: () => toast.success("Contrato assinado com sucesso!"),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useTripwireCheckout() {
  return useMutation({
    mutationFn: (input: { token: string; email: string }) => startTripwireCheckout({ data: input }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useConfirmTripwire() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (token: string) => confirmTripwirePayment({ data: { token } }),
    onSuccess: (_, token) => {
      qc.invalidateQueries({ queryKey: salesKeys.diagnosis(token) });
    },
  });
}

export function useDownloadDiagnosticPdf() {
  return useMutation({
    mutationFn: async (token: string) => {
      const res = await getDiagnosticPdf({ data: { token } });
      const blob = new Blob([Uint8Array.from(atob(res.base64), (c) => c.charCodeAt(0))], {
        type: "application/pdf",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `diagnostico-orbia-${token.slice(0, 8)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    },
  });
}

export function useTrackProposalSection() {
  return useMutation({
    mutationFn: (input: { token: string; sectionKey: string; durationMs: number }) =>
      trackProposalSection({ data: input }),
  });
}

export function useRegisterPartner() {
  return useMutation({
    mutationFn: (input: { name: string; email: string }) => registerPartnerPublic({ data: input }),
    onSuccess: (res) => toast.success(`Cadastro realizado! Seu código: ${res.referralCode}`),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useEnrollColdNurture() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (prospectId: string) => enrollColdNurtureFn({ data: { prospectId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: salesKeys.all });
      toast.success("Lead movido para nutrição longa.");
    },
  });
}

export function useProspectMetaDiagnostics(prospectId: string) {
  return useQuery({
    queryKey: ["sales", "meta-diag", prospectId],
    queryFn: () => getProspectMetaDiagnostics({ data: { prospectId } }),
    enabled: !!prospectId,
  });
}

export function useCommercialOnboarding(clientId: string) {
  return useQuery({
    queryKey: ["sales", "commercial-onboarding", clientId],
    queryFn: () => getCommercialOnboardingFn({ data: { clientId } }),
    enabled: !!clientId,
  });
}

export { trackProspectEvent };
