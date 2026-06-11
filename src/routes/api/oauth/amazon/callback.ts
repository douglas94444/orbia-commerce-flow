import { createFileRoute } from "@tanstack/react-router";
import { completeAmazonOAuth } from "@/modules/integrations/oauth.server";

export const Route = createFileRoute("/api/oauth/amazon/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("spapi_oauth_code") ?? url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const sellingPartnerId = url.searchParams.get("selling_partner_id") ?? "";

        if (!code || !state) {
          return new Response("Missing code or state", { status: 400 });
        }

        try {
          const redirectTo = await completeAmazonOAuth(code, state, sellingPartnerId);
          return Response.redirect(new URL(redirectTo, url.origin), 302);
        } catch (err) {
          console.error("[oauth/amazon] callback error:", err);
          return Response.redirect(new URL("/clients?oauth_error=amazon", url.origin), 302);
        }
      },
    },
  },
});
