// Server-only config. The .server.ts suffix prevents Vite from bundling
// this file into the client — values here never reach the browser.
//
// On Cloudflare Workers, env binds at REQUEST time. Module-scope reads
// (e.g. `const x = process.env.X`) resolve to undefined — always read
// process.env INSIDE a function or handler.

export function getServerConfig() {
  return {
    nodeEnv: process.env.NODE_ENV,
    appUrl: process.env.APP_URL ?? process.env.VITE_APP_URL ?? "http://localhost:5173",
    supabase: {
      url: process.env.SUPABASE_URL,
      publishableKey: process.env.SUPABASE_PUBLISHABLE_KEY,
      serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    },
    nuvemshop: {
      clientId: process.env.NUVEMSHOP_CLIENT_ID,
      clientSecret: process.env.NUVEMSHOP_CLIENT_SECRET,
    },
    shopify: {
      clientId: process.env.SHOPIFY_CLIENT_ID,
      clientSecret: process.env.SHOPIFY_CLIENT_SECRET,
    },
    mercadoLivre: {
      clientId: process.env.ML_CLIENT_ID,
      clientSecret: process.env.ML_CLIENT_SECRET,
    },
    shopee: {
      partnerId: process.env.SHOPEE_PARTNER_ID,
      partnerKey: process.env.SHOPEE_PARTNER_KEY,
    },
    melhorEnvio: {
      clientId: process.env.MELHOR_ENVIO_CLIENT_ID,
      clientSecret: process.env.MELHOR_ENVIO_CLIENT_SECRET,
      token: process.env.MELHOR_ENVIO_TOKEN,
      fromPostalCode: process.env.MELHOR_ENVIO_FROM_POSTAL,
    },
    meta: {
      appId: process.env.META_APP_ID,
      appSecret: process.env.META_APP_SECRET,
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      developerToken: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
      loginCustomerId: process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID,
    },
    resend: {
      apiKey: process.env.RESEND_API_KEY,
      fromEmail: process.env.RESEND_FROM_EMAIL,
    },
    focusNfe: {
      token: process.env.FOCUS_NFE_TOKEN,
      env: (process.env.FOCUS_NFE_ENV ?? "homologacao") as "homologacao" | "producao",
    },
    cloudflare: {
      apiToken: process.env.CLOUDFLARE_API_TOKEN,
    },
    mercadoPago: {
      accessToken: process.env.MP_ACCESS_TOKEN,
      webhookSecret: process.env.MP_WEBHOOK_SECRET,
      publicKey: process.env.MP_PUBLIC_KEY,
    },
    whatsapp: {
      verifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN,
    },
    cron: {
      secret: process.env.CRON_SECRET,
    },
    pagarMe: {
      apiKey: process.env.PAGARME_API_KEY,
      webhookSecret: process.env.PAGARME_WEBHOOK_SECRET,
    },
    demo: {
      enabled: process.env.VITE_DEMO_MODE === "true" || process.env.DEMO_MODE === "true",
    },
  };
}

export function getFocusNfeBaseUrl(): string {
  const env = process.env.FOCUS_NFE_ENV ?? "homologacao";
  return env === "producao" ? "https://api.focusnfe.com.br" : "https://homologacao.focusnfe.com.br";
}

// Guard: call at startup to surface missing env vars early.
export function assertServerConfig() {
  const config = getServerConfig();
  const missing: string[] = [];

  if (!config.supabase.url) missing.push("SUPABASE_URL");
  if (!config.supabase.publishableKey) missing.push("SUPABASE_PUBLISHABLE_KEY");
  if (!config.supabase.serviceRoleKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");

  if (missing.length > 0) {
    throw new Error(`Missing required server env vars: ${missing.join(", ")}`);
  }
}
