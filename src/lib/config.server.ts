// Server-only config. The .server.ts suffix prevents Vite from bundling
// this file into the client — values here never reach the browser.
//
// On Cloudflare Workers, env binds at REQUEST time. Module-scope reads
// (e.g. `const x = process.env.X`) resolve to undefined — always read
// process.env INSIDE a function or handler.

export function getServerConfig() {
  return {
    nodeEnv: process.env.NODE_ENV,
    supabase: {
      url: process.env.SUPABASE_URL,
      publishableKey: process.env.SUPABASE_PUBLISHABLE_KEY,
      serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    },
  }
}

// Guard: call at startup to surface missing env vars early.
export function assertServerConfig() {
  const config = getServerConfig()
  const missing: string[] = []

  if (!config.supabase.url) missing.push('SUPABASE_URL')
  if (!config.supabase.publishableKey) missing.push('SUPABASE_PUBLISHABLE_KEY')
  if (!config.supabase.serviceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY')

  if (missing.length > 0) {
    throw new Error(`Missing required server env vars: ${missing.join(', ')}`)
  }
}
