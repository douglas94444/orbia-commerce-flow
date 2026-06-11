/**
 * Apply LTV Boost migrations 024–027 via Supabase Management API / execute_sql.
 * Requires SUPABASE_ACCESS_TOKEN or run via Supabase MCP apply_migration.
 *
 * Usage:
 *   node scripts/apply-retention-migrations.mjs [--check-only]
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const MIGRATIONS = [
  "024_retention_foundation.sql",
  "025_retention_triggers.sql",
  "026_loyalty_whatsapp.sql",
  "027_flow_ab.sql",
];

try {
  for (const line of readFileSync(join(root, ".env"), "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)="?([^"]+)"?$/);
    if (m) process.env[m[1]] = m[2];
  }
} catch {
  /* ignore */
}

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const checks = [
  { table: "automation_sequences", migration: "024" },
  { table: "abandoned_carts", migration: "025" },
  { table: "loyalty_accounts", migration: "026" },
  { table: "ab_experiments", migration: "027" },
];

const checkOnly = process.argv.includes("--check-only");

for (const { table, migration } of checks) {
  const { error } = await sb.from(table).select("id").limit(1);
  console.log(`${migration} (${table}):`, error ? `MISSING — ${error.message}` : "ok");
}

if (checkOnly) {
  console.log("\nPara aplicar: use Supabase Dashboard SQL ou MCP apply_migration com os arquivos em supabase/migrations/");
  process.exit(0);
}

console.log("\nArquivos a aplicar (em ordem):");
for (const f of MIGRATIONS) {
  console.log(`  supabase/migrations/${f}`);
}
console.log("\nDDL não pode ser executado via supabase-js. Use: npx supabase db push  ou MCP apply_migration.");
