/**
 * Applies migration 012 (cert_path column) via direct Postgres connection.
 *
 * Usage:
 *   set SUPABASE_DB_PASSWORD=your_db_password
 *   node scripts/apply-cert-path.mjs
 *
 * Or:
 *   node scripts/apply-cert-path.mjs --db-url "postgresql://postgres:PASSWORD@db.ztaozvgmzycetiwwkhjc.supabase.co:5432/postgres"
 */

import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const __dir = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)

const dbUrlArg =
  process.argv.find((a) => a.startsWith('--db-url='))?.slice(9) ??
  (process.argv.includes('--db-url') ? process.argv[process.argv.indexOf('--db-url') + 1] : null)

const password = process.env.SUPABASE_DB_PASSWORD
const dbUrl =
  dbUrlArg ??
  (password
    ? `postgresql://postgres:${encodeURIComponent(password)}@db.ztaozvgmzycetiwwkhjc.supabase.co:5432/postgres`
    : null)

if (!dbUrl) {
  console.error('Set SUPABASE_DB_PASSWORD or pass --db-url')
  process.exit(1)
}

let Client
try {
  Client = require('pg').Client
} catch {
  console.error('Installing pg… run: npm install pg')
  process.exit(1)
}

const sql = readFileSync(join(__dir, '..', 'supabase', 'migrations', '012_fiscal_cert_storage.sql'), 'utf8')

const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })
await client.connect()
try {
  await client.query(sql)
  console.log('Migration 012 applied: cert_path column added.')
} finally {
  await client.end()
}
