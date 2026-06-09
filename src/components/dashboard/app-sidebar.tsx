import { Link, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  ChevronLeft,
  FileText,
  LayoutDashboard,
  LifeBuoy,
  Repeat,
  TrendingUp,
  Truck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
}

const nav: NavItem[] = [
  { label: "Visão Geral", to: "/overview", icon: LayoutDashboard },
  { label: "Clientes", to: "/clients", icon: Users },
  { label: "Tráfego", to: "/traffic", icon: TrendingUp },
  { label: "Logística", to: "/logistics", icon: Truck },
  { label: "Retenção", to: "/retention", icon: Repeat },
  { label: "Fiscal", to: "/fiscal", icon: FileText },
  { label: "Analytics", to: "/analytics", icon: BarChart3 },
  { label: "Customer Success", to: "/success", icon: LifeBuoy },
];

export function AppSidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <aside
      className={cn(
        "sticky top-0 z-40 flex h-screen flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-300",
        collapsed ? "w-[76px]" : "w-64",
      )}
    >
      <div className="flex h-16 items-center gap-3 px-5">
        <span className="relative grid size-9 shrink-0 place-items-center">
          <span className="absolute inset-0 rounded-full border border-primary/40" />
          <span className="absolute inset-0 animate-orbit rounded-full border-t-2 border-primary/80" />
          <span className="size-2.5 rounded-full bg-primary text-glow" style={{ boxShadow: "0 0 12px var(--primary)" }} />
        </span>
        {!collapsed && (
          <div className="leading-tight">
            <p className="font-display text-lg font-bold tracking-tight text-foreground">Orbia</p>
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Centro de Operações
            </p>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {nav.map((item) => {
          const active = pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              title={collapsed ? item.label : undefined}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
              )}
            >
              <span className="relative flex size-5 shrink-0 items-center justify-center">
                {active && (
                  <span className="absolute -left-3 h-5 w-0.5 rounded-full bg-primary" style={{ boxShadow: "0 0 8px var(--primary)" }} />
                )}
                <item.icon className={cn("size-5", active && "text-primary")} />
              </span>
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <div
          className={cn(
            "flex items-center gap-3 rounded-xl bg-sidebar-accent/50 p-2.5",
            collapsed && "justify-center",
          )}
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-primary/30 to-accent/30 font-mono text-[11px] font-semibold text-foreground">
            RS
          </span>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-foreground">Ricardo Silva</p>
              <p className="truncate text-[10px] text-muted-foreground">Founder · Acesso total</p>
            </div>
          )}
        </div>
        <button
          onClick={onToggle}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg py-2 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-foreground"
        >
          <ChevronLeft className={cn("size-4 transition-transform", collapsed && "rotate-180")} />
          {!collapsed && "Recolher"}
        </button>
      </div>
    </aside>
  );
}
