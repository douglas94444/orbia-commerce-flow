/**
 * Migration runner for Orbia — applies all supabase/migrations/*.sql in order.
 *
 * Usage (three options):
 *
 *  Option A — DB password (from Dashboard > Project Settings > Database):
 *    node scripts/migrate.mjs --db-url "postgresql://postgres:SUA_SENHA@db.ztaozvgmzycetiwwkhjc.supabase.co:5432/postgres"
 *
 *  Option B — Supabase CLI (after `npx supabase login` with personal access token):
 *    npx supabase db push --linked
 *
 *  Option C — Paste supabase/apply_all_migrations.sql in the SQL Editor at:
 *    https://supabase.com/dashboard/project/ztaozvgmzycetiwwkhjc/sql/new
 */

import { readdir, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dir = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dir, "..");
const require = createRequire(import.meta.url);

// ─── Parse --db-url argument ─────────────────────────────────
const dbUrlArg =
  process.argv.find((a) => a.startsWith("--db-url=")) ??
  (process.argv.indexOf("--db-url") !== -1
    ? process.argv[process.argv.indexOf("--db-url") + 1]
    : null);

if (!dbUrlArg) {
  console.error(
    '\nUsage: node scripts/migrate.mjs --db-url "postgresql://postgres:SENHA@db.ztaozvgmzycetiwwkhjc.supabase.co:5432/postgres"\n',
  );
  process.exit(1);
}

// ─── Install pg if missing ────────────────────────────────────
let Client;
try {
  Client = require("pg").Client;
} catch {
  console.log("Installing pg...");
  const { execSync } = await import("node:child_process");
  execSync("npm install pg --no-save", { stdio: "inherit", cwd: rootDir });
  Client = require("pg").Client;
}

// ─── Run migrations ───────────────────────────────────────────
const client = new Client({ connectionString: dbUrlArg });
await client.connect();
console.log("Connected to database.\n");

const migrationsDir = join(rootDir, "supabase", "migrations");
const files = (await readdir(migrationsDir))
  .filter((f) => f.endsWith(".sql") && /^\d{3}_/.test(f))
  .sort();

let applied = 0;
for (const file of files) {
  const sql = await readFile(join(migrationsDir, file), "utf-8");
  try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query("COMMIT");
    console.log(`✓ ${file}`);
    applied++;
  } catch (err) {
    await client.query("ROLLBACK");
    // Skip "already exists" errors (idempotent re-run)
    if (err.message?.includes("already exists")) {
      console.log(`~ ${file} (skipped — already applied)`);
    } else {
      console.error(`✗ ${file}: ${err.message}`);
      await client.end();
      process.exit(1);
    }
  }
}

await client.end();
console.log(`\nDone. ${applied} migration(s) applied.`);
console.log("\nNext: regenerate TypeScript types:");
console.log(
  '  npx supabase gen types typescript --db-url "..." > src/integrations/supabase/types.ts\n',
);
