import { createFileRoute } from "@tanstack/react-router";
import { completeShopifyOAuth } from "@/modules/integrations/oauth.server";

export const Route = createFileRoute("/api/oauth/shopify/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const shop = url.searchParams.get("shop");

        if (!code || !state || !shop) {
          return new Response("Missing code, state or shop", { status: 400 });
        }

        try {
          const redirectTo = await completeShopifyOAuth(code, state, shop);
          return Response.redirect(new URL(redirectTo, url.origin), 302);
        } catch (err) {
          console.error("[oauth/shopify] callback error:", err);
          return Response.redirect(new URL(`/clients?oauth_error=shopify`, url.origin), 302);
        }
      },
    },
  },
});
