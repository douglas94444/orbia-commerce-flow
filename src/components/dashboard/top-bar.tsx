import { Search, Bell } from "lucide-react";

export function TopBar({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-border bg-background/70 px-6 backdrop-blur-xl">
      <div className="min-w-0">
        <h1 className="truncate font-display text-lg font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative hidden md:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar cliente, pedido, NF…"
            className="h-9 w-56 rounded-lg border border-input bg-muted/40 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground/70 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/40"
          />
        </div>

        <div className="hidden items-center gap-2 rounded-full border border-success/30 bg-success/10 px-3 py-1 sm:flex">
          <span className="size-1.5 rounded-full bg-success" style={{ boxShadow: "0 0 8px var(--success)" }} />
          <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-success">
            Sistema online
          </span>
        </div>

        <button className="relative grid size-9 place-items-center rounded-lg border border-border bg-muted/40 text-muted-foreground transition-colors hover:text-foreground">
          <Bell className="size-4" />
          <span className="absolute right-2 top-2 size-1.5 rounded-full bg-destructive" />
        </button>
      </div>
    </header>
  );
}
