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
    focusNfe: {
      token: process.env.FOCUS_NFE_TOKEN,
      env: (process.env.FOCUS_NFE_ENV ?? "homologacao") as "homologacao" | "producao",
    },
    cloudflare: {
      apiToken: process.env.CLOUDFLARE_API_TOKEN,
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
