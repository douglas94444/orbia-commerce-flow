import { createFileRoute } from "@tanstack/react-router";
import { completeGoogleOAuth } from "@/modules/integrations/oauth.server";

export const Route = createFileRoute("/api/oauth/google/callback")({
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
          const redirectTo = await completeGoogleOAuth(code, state);
          return Response.redirect(new URL(redirectTo, url.origin), 302);
        } catch (err) {
          console.error("[oauth/google] callback error:", err);
          return Response.redirect(new URL("/clients?oauth_error=google", url.origin), 302);
        }
      },
    },
  },
});
