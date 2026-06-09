import { randomBytes } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { exchangeNuvemshopCode, registerNuvemshopWebhooks } from "@/integrations/nuvemshop";
import { getStore } from "@/integrations/nuvemshop/client";
import { exchangeShopifyCode, registerShopifyWebhooks } from "@/integrations/shopify";
import { logAudit, logIntegration } from "@/shared/lib/logger";

export type OAuthProvider = "nuvemshop" | "shopify";

export async function createOAuthState(
  userId: string,
  clientId: string,
  provider: OAuthProvider,
  metadata: Record<string, unknown> = {},
): Promise<string> {
  const state = randomBytes(24).toString("hex");

  const { error } = await supabaseAdmin.from("oauth_states").insert({
    state,
    nonce: randomBytes(16).toString("hex"),
    user_id: userId,
    client_id: clientId,
    provider,
    redirect_to: `/clients/${clientId}`,
    metadata,
  });

  if (error) throw new Error(`Failed to create OAuth state: ${error.message}`);
  return state;
}

export async function consumeOAuthState(state: string) {
  const { data, error } = await supabaseAdmin
    .from("oauth_states")
    .select("*")
    .eq("state", state)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (error || !data) throw new Error("Invalid or expired OAuth state");

  await supabaseAdmin.from("oauth_states").delete().eq("id", data.id);
  return data;
}

export async function storeOAuthConnection(input: {
  clientId: string;
  provider: OAuthProvider;
  externalAccount: string;
  accessToken: string;
  refreshToken?: string | null;
  tokenExpiresAt?: string | null;
  scopes?: string[];
  metadata?: Record<string, unknown>;
  userId: string;
}): Promise<void> {
  const { error } = await supabaseAdmin.from("oauth_connections").upsert(
    {
      client_id: input.clientId,
      provider: input.provider,
      external_account: input.externalAccount,
      access_token: input.accessToken,
      refresh_token: input.refreshToken ?? null,
      token_expires_at: input.tokenExpiresAt ?? null,
      scopes: input.scopes ?? [],
      is_active: true,
      last_refreshed_at: new Date().toISOString(),
      metadata: input.metadata ?? {},
      updated_at: new Date().toISOString(),
    },
    { onConflict: "client_id,provider,external_account" },
  );

  if (error) throw new Error(`Failed to store OAuth connection: ${error.message}`);

  await logAudit({
    user_id: input.userId,
    client_id: input.clientId,
    action: "oauth_connect",
    resource: "oauth_connection",
    resource_id: `${input.provider}:${input.externalAccount}`,
    new_data: { provider: input.provider, external_account: input.externalAccount },
  });
}

export async function completeNuvemshopOAuth(code: string, state: string): Promise<string> {
  const oauthState = await consumeOAuthState(state);
  if (oauthState.provider !== "nuvemshop" || !oauthState.client_id) {
    throw new Error("Invalid OAuth state for Nuvemshop");
  }

  const token = await exchangeNuvemshopCode(code);
  const storeId = String(token.user_id);
  const store = await getStore(storeId, token.access_token);

  await storeOAuthConnection({
    clientId: oauthState.client_id,
    provider: "nuvemshop",
    externalAccount: storeId,
    accessToken: token.access_token,
    scopes: token.scope?.split(",") ?? [],
    metadata: {
      shop_name: store.name?.pt ?? store.name?.es ?? store.original_domain,
      domain: store.original_domain,
    },
    userId: oauthState.user_id,
  });

  try {
    await registerNuvemshopWebhooks(storeId, token.access_token);
    await logIntegration({
      client_id: oauthState.client_id,
      provider: "nuvemshop",
      operation: "register_webhooks",
      status: "success",
    });
  } catch (err) {
    await logIntegration({
      client_id: oauthState.client_id,
      provider: "nuvemshop",
      operation: "register_webhooks",
      status: "error",
      error_message: (err as Error).message,
    });
  }

  return oauthState.redirect_to ?? `/clients/${oauthState.client_id}`;
}

export async function completeShopifyOAuth(
  code: string,
  state: string,
  shop: string,
): Promise<string> {
  const oauthState = await consumeOAuthState(state);
  if (oauthState.provider !== "shopify" || !oauthState.client_id) {
    throw new Error("Invalid OAuth state for Shopify");
  }

  const shopDomain = shop.includes(".myshopify.com") ? shop : `${shop}.myshopify.com`;
  const token = await exchangeShopifyCode(shopDomain, code);

  await storeOAuthConnection({
    clientId: oauthState.client_id,
    provider: "shopify",
    externalAccount: shopDomain,
    accessToken: token.access_token,
    scopes: token.scope?.split(",") ?? [],
    metadata: { shop: shopDomain },
    userId: oauthState.user_id,
  });

  try {
    await registerShopifyWebhooks(shopDomain, token.access_token);
    await logIntegration({
      client_id: oauthState.client_id,
      provider: "shopify",
      operation: "register_webhooks",
      status: "success",
    });
  } catch (err) {
    await logIntegration({
      client_id: oauthState.client_id,
      provider: "shopify",
      operation: "register_webhooks",
      status: "error",
      error_message: (err as Error).message,
    });
  }

  return oauthState.redirect_to ?? `/clients/${oauthState.client_id}`;
}
