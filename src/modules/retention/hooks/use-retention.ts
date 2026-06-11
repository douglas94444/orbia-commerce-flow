import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listAutomations,
  getRetentionStats,
  toggleAutomation,
  getLtvAnalytics,
  getTemplateLibrary,
  getWhatsAppTemplates,
  simulateAutomation,
  applyTemplateFromLibrary,
  updateQuietHours,
} from "../actions.functions";

export const AUTOMATIONS_KEY = ["automations"] as const;
export const RETENTION_STATS_KEY = ["retention-stats"] as const;
export const LTV_ANALYTICS_KEY = ["ltv-analytics"] as const;
export const TEMPLATE_LIBRARY_KEY = ["template-library"] as const;

export function useAutomations() {
  return useQuery({
    queryKey: AUTOMATIONS_KEY,
    queryFn: () => listAutomations(),
    staleTime: 30_000,
  });
}

export function useRetentionStats() {
  return useQuery({
    queryKey: RETENTION_STATS_KEY,
    queryFn: () => getRetentionStats(),
    staleTime: 60_000,
  });
}

export function useLtvAnalytics() {
  return useQuery({
    queryKey: LTV_ANALYTICS_KEY,
    queryFn: () => getLtvAnalytics(),
    staleTime: 120_000,
  });
}

export function useTemplateLibrary() {
  return useQuery({
    queryKey: TEMPLATE_LIBRARY_KEY,
    queryFn: () => getTemplateLibrary(),
    staleTime: 300_000,
  });
}

export function useToggleAutomation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; active: boolean }) => toggleAutomation({ data: vars }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: AUTOMATIONS_KEY });
      toast.success(vars.active ? "Automação ativada." : "Automação pausada.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useWhatsAppTemplates() {
  return useQuery({
    queryKey: ["whatsapp-templates"],
    queryFn: () => getWhatsAppTemplates(),
    staleTime: 60_000,
  });
}

export function useSimulateAutomation() {
  return useMutation({
    mutationFn: (trigger: string) => simulateAutomation({ data: { trigger } }),
    onSuccess: (data) => {
      toast.success(
        `Simulação: ${data.impactedCustomers} clientes, receita esperada ${(data.expectedRevenueCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`,
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useApplyTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { templateId: string; sequenceName?: string }) =>
      applyTemplateFromLibrary({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: AUTOMATIONS_KEY });
      toast.success("Template aplicado como novo fluxo.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateQuietHours() {
  return useMutation({
    mutationFn: (vars: { quietHoursStart: number; quietHoursEnd: number }) =>
      updateQuietHours({ data: vars }),
    onSuccess: () => toast.success("Horário de envio atualizado."),
    onError: (e: Error) => toast.error(e.message),
  });
}
