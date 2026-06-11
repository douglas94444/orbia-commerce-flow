import { Search, Bell } from "lucide-react";

export function TopBar({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className="surface-chrome sticky top-0 z-30 flex h-16 items-center justify-between gap-4 px-6">
      <div className="min-w-0">
        <h1 className="truncate text-lg font-bold tracking-tight text-foreground">{title}</h1>
        <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative hidden md:block">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar cliente, pedido, NF…"
            className="h-10 w-60 rounded-lg border border-input bg-muted/30 pl-10 pr-3 text-sm text-foreground transition-all duration-[180ms] placeholder:text-muted-foreground/60 focus:border-primary/40 focus:bg-muted/40 focus:outline-none focus:ring-2 focus:ring-ring/40"
          />
        </div>

        <div className="hidden items-center gap-2 rounded-full border border-success/25 bg-success/8 px-3 py-1.5 sm:flex">
          <span className="size-1.5 rounded-full bg-success" />
          <span className="text-label !text-success normal-case tracking-normal">Online</span>
        </div>

        <button
          type="button"
          className="relative grid size-10 place-items-center rounded-lg border border-border bg-muted/30 text-muted-foreground transition-all duration-[180ms] hover:border-border-strong hover:bg-muted/50 hover:text-foreground"
        >
          <Bell className="size-4" />
          <span className="absolute right-2.5 top-2.5 size-1.5 rounded-full bg-destructive ring-2 ring-background" />
        </button>
      </div>
    </header>
  );
}
