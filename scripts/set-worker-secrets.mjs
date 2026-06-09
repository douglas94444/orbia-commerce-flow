/**
 * Sets Cloudflare Worker secrets from .env (after deploy).
 *
 * Prerequisites:
 *   npm run build && node scripts/deploy-cloudflare.mjs
 *
 * Usage:
 *   node scripts/set-worker-secrets.mjs
 */

import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

try {
  for (const line of readFileSync(join(root, '.env'), 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)="?([^"]+)"?$/)
    if (m) process.env[m[1]] = m[2]
  }
} catch {
  console.error('.env not found')
  process.exit(1)
}

const SECRETS = [
  'SUPABASE_URL',
  'SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'NUVEMSHOP_CLIENT_ID',
  'NUVEMSHOP_CLIENT_SECRET',
  'SHOPIFY_CLIENT_ID',
  'SHOPIFY_CLIENT_SECRET',
  'FOCUS_NFE_TOKEN',
  'FOCUS_NFE_ENV',
  'APP_URL',
]

const outputDir = join(root, '.output')
let set = 0

for (const key of SECRETS) {
  const value = process.env[key]
  if (!value) {
    console.log(`skip ${key} (not in .env)`)
    continue
  }
  execSync(`npx wrangler --cwd "${outputDir}" secret put ${key}`, {
    input: value,
    stdio: ['pipe', 'inherit', 'inherit'],
    env: process.env,
  })
  set++
}

console.log(`\n${set} secret(s) configured.`)
