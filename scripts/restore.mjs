#!/usr/bin/env node
/**
 * Restore from a Deva Construction backup JSON file.
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
 *   NEXT_PUBLIC_SUPABASE_URL=https://... \
 *   node scripts/restore.mjs path/to/backup.json
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const TABLES_IN_ORDER = [
  "profiles",
  "clients",
  "suppliers",
  "labourers",
  "projects",
  "project_labourers",
  "materials",
  "payments",
  "attendance",
  "project_updates",
  "personal_transactions",
  "project_change_orders",
  "client_payments",
];

const COMPOSITE_KEYS = {
  project_labourers: ["project_id", "labourer_id"],
};

const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/restore.mjs <backup.json>");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const backup = JSON.parse(readFileSync(file, "utf-8"));
const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

console.log(`Backup from: ${backup.metadata.timestamp}`);
console.log("Tables:");
for (const [t, count] of Object.entries(backup.metadata.tables)) {
  console.log(`  ${t}: ${count} rows`);
}

console.log("\nRestoring...\n");

for (const table of TABLES_IN_ORDER) {
  const rows = backup.tables[table];
  if (!rows || rows.length === 0) {
    console.log(`  ${table}: empty, skipping`);
    continue;
  }

  const compositeKey = COMPOSITE_KEYS[table];
  if (compositeKey) {
    const { error: delErr } = await supabase.from(table).delete().gte("created_at", "1900-01-01");
    if (delErr) {
      console.error(`  ${table}: delete failed - ${delErr.message}`);
      continue;
    }
    const { error } = await supabase.from(table).insert(rows);
    if (error) {
      console.error(`  ${table}: insert failed - ${error.message}`);
    } else {
      console.log(`  ${table}: restored ${rows.length} rows (delete+insert)`);
    }
  } else {
    const { error } = await supabase.from(table).upsert(rows, { onConflict: "id" });
    if (error) {
      console.error(`  ${table}: upsert failed - ${error.message}`);
    } else {
      console.log(`  ${table}: restored ${rows.length} rows`);
    }
  }
}

console.log("\nDone.");
