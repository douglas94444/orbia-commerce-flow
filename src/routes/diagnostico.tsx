import { createFileRoute } from "@tanstack/react-router";
import { DiagnosticForm } from "@/modules/sales/components/diagnostic-form";

export const Route = createFileRoute("/diagnostico")({
  head: () => ({ meta: [{ title: "Diagnóstico Gratuito — Orbia" }] }),
  component: () => <DiagnosticForm />,
});
