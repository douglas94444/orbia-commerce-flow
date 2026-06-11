/**
 * Documenta e testa triggers de cron do Worker.
 *
 * Usage:
 *   node scripts/setup-cron-triggers.mjs [--run-all]
 *
 * Requer APP_URL + CRON_SECRET no .env.
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
try {
  for (const line of readFileSync(join(root, ".env"), "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)="?([^"]+)"?$/);
    if (m) process.env[m[1]] = m[2];
  }
} catch {
  /* ignore */
}

const TRIGGERS = [
  { cron: "*/15 * * * *", jobs: ["process-automation-enrollments", "process-outbox"] },
  { cron: "*/5 * * * *", jobs: ["process-outbox"] },
  { cron: "0 6 * * *", jobs: ["health-recalc", "sync-campaigns", "retention-crons", "attribute-conversions"] },
  { cron: "0 */6 * * *", jobs: ["sync-catalog", "compute-rfm"] },
  { cron: "0 3 * * *", jobs: ["cleanup-oauth"] },
];

console.log("Cloudflare Cron Triggers (wrangler.toml + server.ts scheduled handler):\n");
for (const t of TRIGGERS) {
  console.log(`  ${t.cron}`);
  for (const job of t.jobs) {
    console.log(`    → POST /api/cron/run  { "job": "${job}" }`);
  }
  console.log("");
}

const runAll = process.argv.includes("--run-all");
if (!runAll) {
  console.log("Passe --run-all para executar process-automation-enrollments (requer APP_URL + CRON_SECRET).");
  process.exit(0);
}

if (!process.env.APP_URL || !process.env.CRON_SECRET) {
  console.error("Missing APP_URL or CRON_SECRET");
  process.exit(1);
}

for (const job of ["process-automation-enrollments", "retention-crons"]) {
  const res = await fetch(`${process.env.APP_URL}/api/cron/run`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.CRON_SECRET}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ job }),
  });
  const body = await res.text();
  console.log(`${job}: ${res.status}`, body);
}
