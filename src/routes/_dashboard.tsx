import { useState } from "react";
import { Outlet, createFileRoute, useRouterState } from "@tanstack/react-router";
import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { TopBar } from "@/components/dashboard/top-bar";
import { AlertsPanel } from "@/components/dashboard/alerts-panel";

export const Route = createFileRoute("/_dashboard")({
  component: DashboardLayout,
});

const titles: Record<string, { title: string; subtitle: string }> = {
  "/overview": { title: "Visão Geral", subtitle: "Monitoramento da operação em tempo real" },
  "/clients": { title: "Clientes", subtitle: "Carteira, health score e onboarding" },
  "/traffic": { title: "Módulo Tráfego", subtitle: "ROAS por canal e diagnóstico de campanhas" },
  "/logistics": { title: "Módulo Logística", subtitle: "Pedidos omnichannel, estoque e trava fiscal" },
  "/retention": { title: "Módulo Retenção", subtitle: "Automações, segmentação RFM e LTV" },
  "/fiscal": { title: "Módulo Fiscal", subtitle: "Emissão de NF-e e configuração tributária" },
  "/analytics": { title: "Analytics 360", subtitle: "Dados cruzados de todos os módulos" },
  "/success": { title: "Customer Success", subtitle: "Pipeline, onboarding e NPS da carteira" },
};

function DashboardLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const meta =
    Object.entries(titles).find(([k]) => pathname.startsWith(k))?.[1] ?? {
      title: "Orbia",
      subtitle: "Centro de operações",
    };

  return (
    <div className="flex min-h-screen w-full bg-background">
      <AppSidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      <div className="flex min-w-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar title={meta.title} subtitle={meta.subtitle} />
          <main className="grid-texture relative flex-1 overflow-y-auto">
            <div
              className="pointer-events-none absolute inset-0"
              style={{ background: "var(--gradient-orbital)" }}
            />
            <div className="relative mx-auto w-full max-w-[1400px] px-6 py-8">
              <Outlet />
            </div>
          </main>
        </div>
        <AlertsPanel />
      </div>
    </div>
  );
}
