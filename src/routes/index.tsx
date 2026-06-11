import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { SalesPage } from "@/components/marketing/sales-page";
import { supabase } from "@/integrations/supabase/client";
import { resolveHomePath } from "@/modules/auth/resolve-home";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Orbia — E-commerce gerenciado para marcas brasileiras" },
      {
        name: "description",
        content:
          "Tráfego, logística, fiscal, retenção e analytics operados por especialistas. Escale sua loja com a Orbia.",
      },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return;
      supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single()
        .then(({ data: profile }) => {
          navigate({ to: resolveHomePath(profile?.role), replace: true });
        });
    });
  }, [navigate]);

  return <SalesPage />;
}
