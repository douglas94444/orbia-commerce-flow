/**
 * Seed dados de demonstração (demo mode).
 * Usage: node scripts/seed-demo.mjs
 * Ative VITE_DEMO_MODE=true no .env para UI usar dados enriquecidos.
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
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

const { data: pilot } = await sb.from("clients").select("id").eq("slug", "loja-piloto").maybeSingle();
if (!pilot) {
  console.error("Run seed-pilot.mjs first");
  process.exit(1);
}

const clientId = pilot.id;

await sb.from("benchmark_snapshots").insert({
  client_id: clientId,
  metric_key: "roas",
  value: 6.2,
  portfolio_avg: 5.1,
  portfolio_p75: 6.8,
  ai_summary: "Demo: ROAS acima da média da carteira.",
});

await sb.from("pricing_recommendations").upsert(
  {
    client_id: clientId,
    sku: "DEMO-SKU",
    current_cents: 9900,
    suggested_cents: 11900,
    margin_pct: 32,
    rationale: "Demo: ajuste sugerido para margem alvo.",
    confidence: 70,
    status: "draft",
  },
  { onConflict: "client_id,sku" },
).catch(() => {
  /* sku conflict may not have unique — insert instead */
  return sb.from("pricing_recommendations").insert({
    client_id: clientId,
    sku: `DEMO-${Date.now()}`,
    current_cents: 9900,
    suggested_cents: 11900,
    margin_pct: 32,
    rationale: "Demo pricing",
    confidence: 70,
  });
});

console.log("Demo seed OK for client", clientId);
console.log("Set VITE_DEMO_MODE=true in .env for demo UI flag.");
