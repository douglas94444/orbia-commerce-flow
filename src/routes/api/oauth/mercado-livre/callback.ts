import { createFileRoute } from "@tanstack/react-router";
import { completeMercadoLivreOAuth } from "@/modules/integrations/oauth.server";

export const Route = createFileRoute("/api/oauth/mercado-livre/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");

        if (!code || !state) {
          return new Response("Missing code or state", { status: 400 });
        }

        try {
          const redirectTo = await completeMercadoLivreOAuth(code, state);
          return Response.redirect(new URL(redirectTo, url.origin), 302);
        } catch (err) {
          console.error("[oauth/mercado-livre] callback error:", err);
          return Response.redirect(new URL("/clients?oauth_error=mercado_livre", url.origin), 302);
        }
      },
    },
  },
});
