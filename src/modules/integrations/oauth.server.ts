import { randomBytes } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";
import { encryptToken } from "@/lib/crypto.server";
import {
  exchangeMercadoLivreCode,
  registerMercadoLivreWebhooks,
  getMe as getMlMe,
} from "@/integrations/mercado-livre";
import { exchangeNuvemshopCode, registerNuvemshopWebhooks } from "@/integrations/nuvemshop";
import { getStore } from "@/integrations/nuvemshop/client";
import { exchangeShopeeCode, registerShopeeWebhooks } from "@/integrations/shopee";
import { exchangeShopifyCode, registerShopifyWebhooks } from "@/integrations/shopify";
import { exchangeMelhorEnvioCode } from "@/integrations/melhor-envio";
import { exchangeGoogleCode, listAccessibleCustomers } from "@/integrations/google";
import { exchangeMetaCode, getMetaAdAccounts } from "@/integrations/meta";
import { exchangeMetaCode as exchangeWhatsAppCode } from "@/integrations/meta/whatsapp-oauth";
import { exchangeAmazonCode } from "@/integrations/amazon";
import { exchangeTikTokCode } from "@/integrations/tiktok";
import { exchangeInstagramCode } from "@/integrations/instagram";
import { logAudit, logIntegration } from "@/shared/lib/logger";

export type OAuthProvider =
  | "nuvemshop"
  | "shopify"
  | "mercado_livre"
  | "shopee"
  | "meta"
  | "google"
  | "melhor_envio"
  | "whatsapp"
  | "amazon"
  | "tiktok"
  | "instagram";

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
    metadata: metadata as Json,
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
      access_token: encryptToken(input.accessToken),
      refresh_token: input.refreshToken ? encryptToken(input.refreshToken) : null,
      token_expires_at: input.tokenExpiresAt ?? null,
      scopes: input.scopes ?? [],
      is_active: true,
      last_refreshed_at: new Date().toISOString(),
      metadata: (input.metadata ?? {}) as Json,
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
    tokenExpiresAt: new Date(Date.now() + 30 * 86400 * 1000).toISOString(),
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
    tokenExpiresAt: new Date(Date.now() + 365 * 86400 * 1000).toISOString(),
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

export async function completeMercadoLivreOAuth(code: string, state: string): Promise<string> {
  const oauthState = await consumeOAuthState(state);
  if (oauthState.provider !== "mercado_livre" || !oauthState.client_id) {
    throw new Error("Invalid OAuth state for Mercado Livre");
  }

  const token = await exchangeMercadoLivreCode(code);
  const sellerId = String(token.user_id);
  const me = await getMlMe(token.access_token);
  const expiresAt = new Date(Date.now() + token.expires_in * 1000).toISOString();

  await storeOAuthConnection({
    clientId: oauthState.client_id,
    provider: "mercado_livre",
    externalAccount: sellerId,
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    tokenExpiresAt: expiresAt,
    scopes: token.scope?.split(" ") ?? [],
    metadata: { nickname: me.nickname },
    userId: oauthState.user_id,
  });

  try {
    await registerMercadoLivreWebhooks(sellerId, token.access_token);
    await logIntegration({
      client_id: oauthState.client_id,
      provider: "mercado_livre",
      operation: "register_webhooks",
      status: "success",
    });
  } catch (err) {
    await logIntegration({
      client_id: oauthState.client_id,
      provider: "mercado_livre",
      operation: "register_webhooks",
      status: "error",
      error_message: (err as Error).message,
    });
  }

  return oauthState.redirect_to ?? `/clients/${oauthState.client_id}`;
}

export async function completeShopeeOAuth(
  code: string,
  state: string,
  shopId: string,
): Promise<string> {
  const oauthState = await consumeOAuthState(state);
  if (oauthState.provider !== "shopee" || !oauthState.client_id) {
    throw new Error("Invalid OAuth state for Shopee");
  }

  const token = await exchangeShopeeCode(shopId, code);
  const expiresAt = new Date(Date.now() + token.expire_in * 1000).toISOString();

  await storeOAuthConnection({
    clientId: oauthState.client_id,
    provider: "shopee",
    externalAccount: shopId,
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    tokenExpiresAt: expiresAt,
    metadata: { shop_id: shopId },
    userId: oauthState.user_id,
  });

  try {
    await registerShopeeWebhooks(shopId, token.access_token);
    await logIntegration({
      client_id: oauthState.client_id,
      provider: "shopee",
      operation: "register_webhooks",
      status: "success",
    });
  } catch (err) {
    await logIntegration({
      client_id: oauthState.client_id,
      provider: "shopee",
      operation: "register_webhooks",
      status: "error",
      error_message: (err as Error).message,
    });
  }

  return oauthState.redirect_to ?? `/clients/${oauthState.client_id}`;
}

export async function completeMetaOAuth(code: string, state: string): Promise<string> {
  const oauthState = await consumeOAuthState(state);
  if (oauthState.provider !== "meta" || !oauthState.client_id) {
    throw new Error("Invalid OAuth state for Meta");
  }

  const token = await exchangeMetaCode(code);
  const accounts = await getMetaAdAccounts(token.access_token);
  const primary = accounts[0];
  const externalAccount = primary?.id ?? "meta-default";
  const expiresAt = token.expires_in
    ? new Date(Date.now() + token.expires_in * 1000).toISOString()
    : null;

  await storeOAuthConnection({
    clientId: oauthState.client_id,
    provider: "meta",
    externalAccount,
    accessToken: token.access_token,
    tokenExpiresAt: expiresAt,
    scopes: ["ads_read", "ads_management"],
    metadata: {
      ad_accounts: accounts.map((a) => ({ id: a.id, name: a.name })),
    },
    userId: oauthState.user_id,
  });

  await logIntegration({
    client_id: oauthState.client_id,
    provider: "meta",
    operation: "oauth_connect",
    status: "success",
    metadata: { ad_account_count: accounts.length },
  });

  return oauthState.redirect_to ?? `/clients/${oauthState.client_id}`;
}

export async function completeMelhorEnvioOAuth(code: string, state: string): Promise<string> {
  const oauthState = await consumeOAuthState(state);
  if (oauthState.provider !== "melhor_envio" || !oauthState.client_id) {
    throw new Error("Invalid OAuth state for Melhor Envio");
  }

  const token = await exchangeMelhorEnvioCode(code);
  const expiresAt = new Date(Date.now() + token.expires_in * 1000).toISOString();

  await storeOAuthConnection({
    clientId: oauthState.client_id,
    provider: "melhor_envio",
    externalAccount: "default",
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    tokenExpiresAt: expiresAt,
    userId: oauthState.user_id,
  });

  await logIntegration({
    client_id: oauthState.client_id,
    provider: "melhor_envio",
    operation: "oauth_connect",
    status: "success",
  });

  return oauthState.redirect_to ?? `/clients/${oauthState.client_id}`;
}

export async function completeGoogleOAuth(code: string, state: string): Promise<string> {
  const oauthState = await consumeOAuthState(state);
  if (oauthState.provider !== "google" || !oauthState.client_id) {
    throw new Error("Invalid OAuth state for Google Ads");
  }

  const token = await exchangeGoogleCode(code);
  const customers = await listAccessibleCustomers(token.access_token);
  const primary = customers[0];
  const externalAccount = primary?.id ?? "google-default";
  const expiresAt = new Date(Date.now() + token.expires_in * 1000).toISOString();

  await storeOAuthConnection({
    clientId: oauthState.client_id,
    provider: "google",
    externalAccount,
    accessToken: token.access_token,
    refreshToken: token.refresh_token ?? null,
    tokenExpiresAt: expiresAt,
    scopes: token.scope?.split(" ") ?? [],
    metadata: { customers },
    userId: oauthState.user_id,
  });

  await logIntegration({
    client_id: oauthState.client_id,
    provider: "google",
    operation: "oauth_connect",
    status: "success",
    metadata: { customer_count: customers.length },
  });

  return oauthState.redirect_to ?? `/clients/${oauthState.client_id}`;
}

async function fetchWhatsAppPhone(accessToken: string): Promise<{
  wabaId: string;
  phoneNumberId: string;
  displayPhone: string;
} | null> {
  const bizRes = await fetch(
    `https://graph.facebook.com/v21.0/me/businesses?access_token=${accessToken}`,
  );
  const bizBody = (await bizRes.json()) as { data?: Array<{ id: string }> };
  const businessId = bizBody.data?.[0]?.id;
  if (!businessId) return null;

  const wabaRes = await fetch(
    `https://graph.facebook.com/v21.0/${businessId}/owned_whatsapp_business_accounts?access_token=${accessToken}`,
  );
  const wabaBody = (await wabaRes.json()) as { data?: Array<{ id: string }> };
  const wabaId = wabaBody.data?.[0]?.id;
  if (!wabaId) return null;

  const phoneRes = await fetch(
    `https://graph.facebook.com/v21.0/${wabaId}/phone_numbers?access_token=${accessToken}`,
  );
  const phoneBody = (await phoneRes.json()) as {
    data?: Array<{ id: string; display_phone_number: string }>;
  };
  const phone = phoneBody.data?.[0];
  if (!phone) return null;

  return {
    wabaId,
    phoneNumberId: phone.id,
    displayPhone: phone.display_phone_number,
  };
}

export async function completeMetaWhatsAppOAuth(code: string, state: string): Promise<string> {
  const oauthState = await consumeOAuthState(state);
  if (oauthState.provider !== "whatsapp" || !oauthState.client_id) {
    throw new Error("Invalid OAuth state for WhatsApp");
  }

  const token = await exchangeWhatsAppCode(code);
  const wa = await fetchWhatsAppPhone(token.access_token);
  if (!wa) throw new Error("Nenhum número WhatsApp Business encontrado na conta Meta");

  const expiresAt = token.expires_in
    ? new Date(Date.now() + token.expires_in * 1000).toISOString()
    : null;

  await storeOAuthConnection({
    clientId: oauthState.client_id,
    provider: "whatsapp",
    externalAccount: wa.phoneNumberId,
    accessToken: token.access_token,
    tokenExpiresAt: expiresAt,
    scopes: ["whatsapp_business_messaging", "whatsapp_business_management"],
    metadata: {
      waba_id: wa.wabaId,
      phone_number_id: wa.phoneNumberId,
      display_phone: wa.displayPhone,
    },
    userId: oauthState.user_id,
  });

  await logIntegration({
    client_id: oauthState.client_id,
    provider: "meta",
    operation: "whatsapp_oauth_connect",
    status: "success",
    metadata: { phone_number_id: wa.phoneNumberId },
  });

  return oauthState.redirect_to ?? `/clients/${oauthState.client_id}`;
}

export async function completeAmazonOAuth(
  code: string,
  state: string,
  sellingPartnerId: string,
): Promise<string> {
  const oauthState = await consumeOAuthState(state);
  if (oauthState.provider !== "amazon" || !oauthState.client_id) {
    throw new Error("Invalid OAuth state for Amazon");
  }

  const token = await exchangeAmazonCode(code);
  const expiresAt = new Date(Date.now() + token.expires_in * 1000).toISOString();
  const sellerId =
    sellingPartnerId ||
    String((oauthState.metadata as Record<string, unknown>)?.seller_id ?? "amazon-seller");

  await storeOAuthConnection({
    clientId: oauthState.client_id,
    provider: "amazon",
    externalAccount: sellerId,
    accessToken: token.access_token,
    refreshToken: token.refresh_token ?? null,
    tokenExpiresAt: expiresAt,
    userId: oauthState.user_id,
  });

  await logIntegration({
    client_id: oauthState.client_id,
    provider: "amazon",
    operation: "oauth_connect",
    status: "success",
    metadata: { selling_partner_id: sellerId },
  });

  return oauthState.redirect_to ?? `/clients/${oauthState.client_id}`;
}

export async function completeTikTokOAuth(
  code: string,
  state: string,
  shopId: string,
): Promise<string> {
  const oauthState = await consumeOAuthState(state);
  if (oauthState.provider !== "tiktok" || !oauthState.client_id) {
    throw new Error("Invalid OAuth state for TikTok");
  }

  const token = await exchangeTikTokCode(code);
  const resolvedShopId =
    shopId ||
    token.shop_id ||
    String((oauthState.metadata as Record<string, unknown>)?.shop_id ?? "");
  if (!resolvedShopId) throw new Error("shop_id ausente no callback TikTok");

  const expiresAt = new Date(Date.now() + token.access_token_expire_in * 1000).toISOString();

  await storeOAuthConnection({
    clientId: oauthState.client_id,
    provider: "tiktok",
    externalAccount: resolvedShopId,
    accessToken: token.access_token,
    refreshToken: token.refresh_token ?? null,
    tokenExpiresAt: expiresAt,
    metadata: { shop_id: resolvedShopId },
    userId: oauthState.user_id,
  });

  await logIntegration({
    client_id: oauthState.client_id,
    provider: "tiktok",
    operation: "oauth_connect",
    status: "success",
    metadata: { shop_id: resolvedShopId },
  });

  return oauthState.redirect_to ?? `/clients/${oauthState.client_id}`;
}

export async function completeInstagramOAuth(code: string, state: string): Promise<string> {
  const oauthState = await consumeOAuthState(state);
  if (oauthState.provider !== "instagram" || !oauthState.client_id) {
    throw new Error("Invalid OAuth state for Instagram");
  }

  const pageId = String((oauthState.metadata as Record<string, unknown>)?.page_id ?? "");
  if (!pageId) throw new Error("page_id ausente no estado OAuth Instagram");

  const token = await exchangeInstagramCode(code);
  const expiresAt = token.expires_in
    ? new Date(Date.now() + token.expires_in * 1000).toISOString()
    : null;

  await storeOAuthConnection({
    clientId: oauthState.client_id,
    provider: "instagram",
    externalAccount: pageId,
    accessToken: token.access_token,
    tokenExpiresAt: expiresAt,
    scopes: ["commerce_account_read", "instagram_basic"],
    metadata: { page_id: pageId },
    userId: oauthState.user_id,
  });

  await logIntegration({
    client_id: oauthState.client_id,
    provider: "instagram",
    operation: "oauth_connect",
    status: "success",
    metadata: { page_id: pageId },
  });

  return oauthState.redirect_to ?? `/clients/${oauthState.client_id}`;
}
