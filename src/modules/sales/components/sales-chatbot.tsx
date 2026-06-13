import { Link } from "@tanstack/react-router";
import { MessageCircle, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";

/** Chatbot de qualificação — abre após 2 minutos no site. */
export function SalesChatbot() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [visible, setVisible] = useState(false);
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const isPublic =
    !pathname.startsWith("/login") &&
    !pathname.startsWith("/overview") &&
    !pathname.startsWith("/sales") &&
    !pathname.startsWith("/clients");

  useEffect(() => {
    if (!isPublic || dismissed) return;
    const timer = setTimeout(() => setVisible(true), 120_000);
    return () => clearTimeout(timer);
  }, [isPublic, dismissed]);

  if (!visible || dismissed) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {open ? (
        <div className="w-80 rounded-2xl border border-border bg-card shadow-xl overflow-hidden">
          <div className="flex items-center justify-between bg-primary/10 px-4 py-3">
            <span className="text-sm font-medium">Orbia Assistente</span>
            <button type="button" onClick={() => setOpen(false)}><X className="h-4 w-4" /></button>
          </div>
          <div className="p-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              Olá! Percebi que você está explorando a Orbia. Quer um diagnóstico gratuito da sua operação de e-commerce?
            </p>
            <Link
              to="/diagnostico"
              className="block w-full rounded-lg bg-primary-gradient py-2 text-center text-sm font-semibold text-primary-foreground"
              onClick={() => setDismissed(true)}
            >
              Fazer diagnóstico gratuito
            </Link>
            <button type="button" className="text-xs text-muted-foreground w-full" onClick={() => setDismissed(true)}>
              Agora não
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-gradient text-primary-foreground shadow-lg hover:scale-105 transition-transform"
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      )}
    </div>
  );
}
