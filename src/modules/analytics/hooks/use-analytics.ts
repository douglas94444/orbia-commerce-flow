import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getPortfolioAnalytics,
  getNfeCount30d,
  listOperationAlerts,
  getClientAiInsights,
  exportPortfolioAnalytics,
  getMonthlyReportHtml,
  getMonthlyReportPdf,
} from "../actions.functions";

export const ANALYTICS_KEY = ["portfolio-analytics"] as const;
export const NFE_COUNT_KEY = ["nfe-count-30d"] as const;
export const ALERTS_KEY = ["operation-alerts"] as const;

export function usePortfolioAnalytics() {
  return useQuery({
    queryKey: ANALYTICS_KEY,
    queryFn: () => getPortfolioAnalytics(),
    staleTime: 60_000,
  });
}

export function useNfeCount30d() {
  return useQuery({
    queryKey: NFE_COUNT_KEY,
    queryFn: () => getNfeCount30d(),
    staleTime: 60_000,
  });
}

export function useOperationAlerts() {
  return useQuery({
    queryKey: ALERTS_KEY,
    queryFn: () => listOperationAlerts(),
    staleTime: 30_000,
  });
}

export const AI_INSIGHTS_KEY = (clientId?: string) =>
  ["ai-insights", clientId ?? "portfolio"] as const;

export function useAiInsights(clientId?: string) {
  return useQuery({
    queryKey: AI_INSIGHTS_KEY(clientId),
    queryFn: () => getClientAiInsights({ data: clientId ? { clientId } : {} }),
    staleTime: 5 * 60_000,
    retry: false,
  });
}

export function useDownloadMonthlyReport(clientId?: string) {
  return useMutation({
    mutationFn: () => getMonthlyReportHtml({ data: clientId ? { clientId } : {} }),
    onSuccess: (res) => {
      const blob = new Blob([res.html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `relatorio-mensal-${new Date().toISOString().slice(0, 7)}.html`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Relatório mensal baixado (imprima como PDF no navegador)");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDownloadMonthlyReportPdf(clientId?: string) {
  return useMutation({
    mutationFn: () => getMonthlyReportPdf({ data: clientId ? { clientId } : {} }),
    onSuccess: (res) => {
      const bytes = Uint8Array.from(atob(res.pdfBase64), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("PDF mensal baixado");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useExportPortfolioAnalytics() {
  return useMutation({
    mutationFn: () => exportPortfolioAnalytics(),
    onSuccess: (res) => {
      const blob = new Blob([res.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `analytics-360-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Analytics 360 exportado");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
