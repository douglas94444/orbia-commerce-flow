import { createFileRoute } from "@tanstack/react-router";
import { completeTikTokOAuth } from "@/modules/integrations/oauth.server";

export const Route = createFileRoute("/api/oauth/tiktok/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const shopId = url.searchParams.get("shop_id") ?? "";

        if (!code || !state) {
          return new Response("Missing code or state", { status: 400 });
        }

        try {
          const redirectTo = await completeTikTokOAuth(code, state, shopId);
          return Response.redirect(new URL(redirectTo, url.origin), 302);
        } catch (err) {
          console.error("[oauth/tiktok] callback error:", err);
          return Response.redirect(new URL("/clients?oauth_error=tiktok", url.origin), 302);
        }
      },
    },
  },
});
