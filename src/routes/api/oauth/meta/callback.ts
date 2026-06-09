import { createFileRoute } from "@tanstack/react-router";
import { completeMetaOAuth } from "@/modules/integrations/oauth.server";

export const Route = createFileRoute("/api/oauth/meta/callback")({
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
          const redirectTo = await completeMetaOAuth(code, state);
          return Response.redirect(new URL(redirectTo, url.origin), 302);
        } catch (err) {
          console.error("[oauth/meta] callback error:", err);
          return Response.redirect(new URL("/clients?oauth_error=meta", url.origin), 302);
        }
      },
    },
  },
});
