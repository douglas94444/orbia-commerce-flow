import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { ScanLine, Package, Truck, Inbox } from "lucide-react";
import { useSession } from "@/modules/auth/hooks/use-session";
import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useOfflineSync } from "@/modules/logistics/ops-pwa/use-offline-sync";
import { useOpsAccess } from "@/modules/auth/hooks/use-ops-access";

export const Route = createFileRoute("/ops")({
  head: () => ({ meta: [{ title: "Fulfillly Ops — Orbia" }] }),
  component: OpsLayout,
});

function OpsLayout() {
  const { session, loading } = useSession();
  const navigate = useNavigate();
  const { isOnline, pendingCount } = useOfflineSync();
  const { data: opsAccess, isLoading: loadingOps } = useOpsAccess();

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/login" });
  }, [loading, session, navigate]);

  useEffect(() => {
    if (!loadingOps && opsAccess && !opsAccess.allowed) {
      navigate({ to: "/login" });
    }
  }, [loadingOps, opsAccess, navigate]);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw-ops.js").catch(() => undefined);
    }
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur px-4 py-3">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <div>
            <span className="font-display text-sm font-semibold tracking-tight">Fulfillly Ops</span>
            {!isOnline && (
              <p className="text-[10px] text-warning">Offline — {pendingCount} na fila</p>
            )}
          </div>
          <nav className="flex gap-2">
            <Link
              to="/ops"
              className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              activeProps={{ className: "bg-primary/10 text-primary" }}
            >
              <Inbox className="size-5" />
            </Link>
            <Link
              to="/ops/picking"
              className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              activeProps={{ className: "bg-primary/10 text-primary" }}
            >
              <ScanLine className="size-5" />
            </Link>
            <Link
              to="/ops/packing"
              className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              activeProps={{ className: "bg-primary/10 text-primary" }}
            >
              <Package className="size-5" />
            </Link>
            <Link
              to="/ops/receiving"
              className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              activeProps={{ className: "bg-primary/10 text-primary" }}
            >
              <Truck className="size-5" />
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-lg p-4">
        <Outlet />
      </main>
    </div>
  );
}
