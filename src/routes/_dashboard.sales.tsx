import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Flame,
  LayoutGrid,
  List,
  Loader2,
  Plus,
  Search,
  Snowflake,
  Sun,
} from "lucide-react";
import { PageIntro, Panel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatBRL } from "@/lib/format";
import {
  usePipelineStages,
  useProspects,
  useRecentProspectEvents,
  useSalesStaff,
} from "@/modules/sales/hooks/use-sales";
import type { SalesProspectRow } from "@/modules/sales/actions.functions";

export const Route = createFileRoute("/_dashboard/sales")({
  head: () => ({ meta: [{ title: "Vendas — Orbia" }] }),
  component: SalesPage,
});

const TEMP_ICONS = {
  hot: Flame,
  warm: Sun,
  cold: Snowflake,
} as const;

function TempBadge({ temp }: { temp: string }) {
  const Icon = TEMP_ICONS[temp as keyof typeof TEMP_ICONS] ?? Sun;
  const colors =
    temp === "hot"
      ? "text-red-400 bg-red-400/10"
      : temp === "warm"
        ? "text-amber-400 bg-amber-400/10"
        : "text-sky-400 bg-sky-400/10";
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", colors)}>
      <Icon className="h-3 w-3" />
      {temp}
    </span>
  );
}

function ProspectCard({ p }: { p: SalesProspectRow }) {
  return (
    <Link
      to="/sales/$prospectId"
      params={{ prospectId: p.id }}
      className="block rounded-lg border border-border/60 bg-card/50 p-3 transition hover:border-primary/40 hover:bg-card"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium text-sm">{p.companyName}</p>
          <p className="text-xs text-muted-foreground">{p.contactName}</p>
        </div>
        <TempBadge temp={p.temperature} />
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <span className="font-mono">{p.qualificationScore}pts</span>
        <span>{formatBRL(p.monthlyRevenueCents / 100, true)}</span>
      </div>
    </Link>
  );
}

function SalesPage() {
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string>();
  const [tempFilter, setTempFilter] = useState<"cold" | "warm" | "hot">();
  const [staffFilter, setStaffFilter] = useState<string>();

  const { data: stages = [], isLoading: loadingStages } = usePipelineStages();
  const { data: prospects = [], isLoading: loadingProspects } = useProspects({
    stageId: stageFilter,
    temperature: tempFilter,
    assignedStaffId: staffFilter,
    search: search || undefined,
  });
  const { data: staff = [] } = useSalesStaff();
  const { data: events = [] } = useRecentProspectEvents();

  const byStage = useMemo(() => {
    const map = new Map<string, SalesProspectRow[]>();
    for (const s of stages) map.set(s.id, []);
    for (const p of prospects) {
      const list = map.get(p.stageId) ?? [];
      list.push(p);
      map.set(p.stageId, list);
    }
    return map;
  }, [stages, prospects]);

  const loading = loadingStages || loadingProspects;

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Motor de Vendas"
        title="Pipeline comercial"
        description="Prospects, qualificação BANT, diagnósticos e fechamento até onboarding."
        action={
          <div className="flex gap-2">
            <Link to="/sales/partners">
              <Button variant="outline" size="sm">Parceiros</Button>
            </Link>
            <Link to="/sales/metrics">
              <Button variant="outline" size="sm">Métricas</Button>
            </Link>
          </div>
        }
      />

      {events.length > 0 && (
        <Panel className="border-primary/20 bg-primary/5 p-4">
          <p className="text-xs font-medium text-primary mb-2">Atividade recente (24h)</p>
          <div className="flex flex-wrap gap-2">
            {events.slice(0, 5).map((e) => (
              <span key={e.id} className="text-xs text-muted-foreground rounded bg-background/60 px-2 py-1">
                {(e.sales_prospects as { company_name?: string })?.company_name} — {e.event_type}
              </span>
            ))}
          </div>
        </Panel>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            className="w-full rounded-lg border border-border bg-background pl-9 pr-3 py-2 text-sm"
            placeholder="Buscar prospect..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          value={tempFilter ?? ""}
          onChange={(e) => setTempFilter((e.target.value || undefined) as typeof tempFilter)}
        >
          <option value="">Temperatura</option>
          <option value="hot">Quente</option>
          <option value="warm">Morno</option>
          <option value="cold">Frio</option>
        </select>
        <select
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          value={staffFilter ?? ""}
          onChange={(e) => setStaffFilter(e.target.value || undefined)}
        >
          <option value="">Responsável</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <div className="flex rounded-lg border border-border overflow-hidden">
          <button
            type="button"
            className={cn("px-3 py-2", view === "kanban" && "bg-primary/10 text-primary")}
            onClick={() => setView("kanban")}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            type="button"
            className={cn("px-3 py-2", view === "list" && "bg-primary/10 text-primary")}
            onClick={() => setView("list")}
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : view === "kanban" ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {stages.map((stage) => (
            <div key={stage.id} className="min-w-[260px] flex-shrink-0">
              <div className="mb-3 flex items-center gap-2">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: stage.color }}
                />
                <h3 className="text-sm font-medium">{stage.label}</h3>
                <span className="text-xs text-muted-foreground font-mono">
                  {(byStage.get(stage.id) ?? []).length}
                </span>
              </div>
              <div className="space-y-2 min-h-[120px]">
                {(byStage.get(stage.id) ?? []).map((p) => (
                  <ProspectCard key={p.id} p={p} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Panel>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="pb-3 pr-4">Empresa</th>
                <th className="pb-3 pr-4">Score</th>
                <th className="pb-3 pr-4">Estágio</th>
                <th className="pb-3 pr-4">Origem</th>
                <th className="pb-3">Faturamento</th>
              </tr>
            </thead>
            <tbody>
              {prospects.map((p) => (
                <tr key={p.id} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="py-3 pr-4">
                    <Link to="/sales/$prospectId" params={{ prospectId: p.id }} className="font-medium hover:text-primary">
                      {p.companyName}
                    </Link>
                    <p className="text-xs text-muted-foreground">{p.contactName}</p>
                  </td>
                  <td className="py-3 pr-4">
                    <span className="font-mono">{p.qualificationScore}</span>
                    <TempBadge temp={p.temperature} />
                  </td>
                  <td className="py-3 pr-4 text-muted-foreground">{p.stageLabel}</td>
                  <td className="py-3 pr-4 text-muted-foreground">{p.source}</td>
                  <td className="py-3 font-mono">{formatBRL(p.monthlyRevenueCents / 100, true)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}
    </div>
  );
}
