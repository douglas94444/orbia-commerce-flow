/**
 * Deploy prebuilt Nitro output to Cloudflare Workers.
 *
 * Prerequisites:
 *   1. npm run build
 *   2. CLOUDFLARE_API_TOKEN in .env
 *   3. Worker secrets configured (see below)
 *
 * Secrets to set in Cloudflare dashboard or via:
 *   npx wrangler --cwd .output secret put SUPABASE_URL
 *
 * Required secrets:
 *   SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY
 *   APP_URL (public Worker URL)
 *   NUVEMSHOP_CLIENT_ID, NUVEMSHOP_CLIENT_SECRET
 *   SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET
 *   ML_CLIENT_ID, ML_CLIENT_SECRET
 *   SHOPEE_PARTNER_ID, SHOPEE_PARTNER_KEY
 *   MELHOR_ENVIO_CLIENT_ID, MELHOR_ENVIO_CLIENT_SECRET, MELHOR_ENVIO_TOKEN
 *   META_APP_ID, META_APP_SECRET
 *   RESEND_API_KEY, RESEND_FROM_EMAIL
 *   FOCUS_NFE_TOKEN, FOCUS_NFE_ENV=homologacao
 *
 * After deploy: node scripts/set-worker-secrets.mjs
 *
 * Cloudflare Cron Triggers (configure in Dashboard → Triggers):
 *   0 6 * * *   — POST /api/cron/run { "job": "health-recalc" } then { "job": "sync-campaigns" }
 *   0 */6 * * * — POST /api/cron/run { "job": "sync-catalog" } + { "job": "process-outbox" }
 *   0 3 * * *   — POST /api/cron/run { "job": "cleanup-oauth" }
 * Header: Authorization: Bearer {CRON_SECRET}
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = join(__dir, "..");

try {
  const raw = readFileSync(join(root, ".env"), "utf8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^([A-Z_]+)="?([^"]+)"?$/);
    if (m) process.env[m[1]] = m[2];
  }
} catch {
  /* ignore */
}

if (!process.env.CLOUDFLARE_API_TOKEN) {
  console.error("Missing CLOUDFLARE_API_TOKEN in .env");
  console.error(
    "Create token at: https://developers.cloudflare.com/fundamentals/api/get-started/create-token/",
  );
  process.exit(1);
}

console.log("Deploying to Cloudflare Workers…");
execSync("npx nitro deploy --prebuilt", { cwd: root, stdio: "inherit", env: process.env });
console.log("Deploy complete.");
