import { createFileRoute } from "@tanstack/react-router";
import { DiagnosticForm } from "@/modules/sales/components/diagnostic-form";

export const Route = createFileRoute("/diagnostico/$segment")({
  validateSearch: (s: Record<string, unknown>) => ({
    ref: typeof s.ref === "string" ? s.ref : undefined,
  }),
  head: ({ params }) => ({
    meta: [{ title: `Diagnóstico ${params.segment} — Orbia` }],
  }),
  component: DiagnosticoSegmentPage,
});

function DiagnosticoSegmentPage() {
  const { segment } = Route.useParams();
  const search = Route.useSearch() as { ref?: string };
  return <DiagnosticForm segment={segment} referralCode={search.ref} />;
}
