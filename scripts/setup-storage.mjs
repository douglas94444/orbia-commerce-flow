/**
 * Creates storage buckets via Supabase API (alternative to migration 013).
 * Run: node scripts/setup-storage.mjs
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = join(__dir, "..");

try {
  const raw = readFileSync(join(root, ".env"), "utf8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^([A-Z_]+)="?([^"]+)"?$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {
  /* ignore */
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const buckets = [
  { id: "fiscal-certificates", public: false, fileSizeLimit: 5242880 },
  { id: "nfe-xml", public: false, fileSizeLimit: 10485760 },
];

for (const b of buckets) {
  const { error } = await supabase.storage.createBucket(b.id, {
    public: b.public,
    fileSizeLimit: b.fileSizeLimit,
  });
  if (error && !error.message.includes("already exists")) {
    console.error(`Bucket ${b.id}:`, error.message);
  } else {
    console.log(`Bucket ${b.id}: ok`);
  }
}
