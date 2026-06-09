import { createFileRoute } from "@tanstack/react-router";
import { completeShopeeOAuth } from "@/modules/integrations/oauth.server";

export const Route = createFileRoute("/api/oauth/shopee/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const shopId = url.searchParams.get("shop_id");

        if (!code || !state || !shopId) {
          return new Response("Missing code, state or shop_id", { status: 400 });
        }

        try {
          const redirectTo = await completeShopeeOAuth(code, state, shopId);
          return Response.redirect(new URL(redirectTo, url.origin), 302);
        } catch (err) {
          console.error("[oauth/shopee] callback error:", err);
          return Response.redirect(new URL("/clients?oauth_error=shopee", url.origin), 302);
        }
      },
    },
  },
});
