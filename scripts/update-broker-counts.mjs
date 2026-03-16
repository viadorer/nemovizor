#!/usr/bin/env node
/**
 * Updates brokers.active_listings and agencies.total_listings/total_brokers
 * using efficient batch operations.
 */
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

function loadEnv() {
  const envPath = resolve(ROOT, ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnv();

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

console.log("Step 1: Counting active properties per broker...");

// Count active properties per broker_id
const countMap = {};
let from = 0;
const PAGE = 1000;
while (true) {
  const { data, error } = await sb
    .from("properties")
    .select("broker_id")
    .eq("active", true)
    .not("broker_id", "is", null)
    .range(from, from + PAGE - 1);
  if (error) { console.error("Error fetching:", error.message); break; }
  if (!data || data.length === 0) break;
  for (const row of data) {
    countMap[row.broker_id] = (countMap[row.broker_id] || 0) + 1;
  }
  console.log(`  ...scanned ${from + data.length} properties`);
  if (data.length < PAGE) break;
  from += PAGE;
}

const brokerIds = Object.keys(countMap);
console.log(`Found ${brokerIds.length} brokers with active properties\n`);

// Step 2: Batch update brokers (50 at a time with Promise.all)
console.log("Step 2: Updating broker counts...");
const BATCH = 50;
let updated = 0;
for (let i = 0; i < brokerIds.length; i += BATCH) {
  const batch = brokerIds.slice(i, i + BATCH);
  await Promise.all(
    batch.map(async (brokerId) => {
      const { error } = await sb
        .from("brokers")
        .update({ active_listings: countMap[brokerId] })
        .eq("id", brokerId);
      if (error) console.error(`  Error ${brokerId}:`, error.message);
      else updated++;
    })
  );
  if ((i + BATCH) % 500 === 0 || i + BATCH >= brokerIds.length) {
    console.log(`  ...updated ${Math.min(i + BATCH, brokerIds.length)}/${brokerIds.length}`);
  }
}

// Step 3: Zero out brokers with no active properties (batch)
console.log("\nStep 3: Zeroing inactive brokers...");
const { error: zeroErr } = await sb
  .from("brokers")
  .update({ active_listings: 0 })
  .not("id", "in", `(${brokerIds.join(",")})`);
// If too many IDs for NOT IN, do it differently:
if (zeroErr) {
  console.log("  Falling back to individual zero updates...");
  const { data: allBrokers } = await sb.from("brokers").select("id");
  if (allBrokers) {
    const toZero = allBrokers.filter((b) => !countMap[b.id]).map((b) => b.id);
    for (let i = 0; i < toZero.length; i += BATCH) {
      const batch = toZero.slice(i, i + BATCH);
      await Promise.all(
        batch.map(async (id) => {
          await sb.from("brokers").update({ active_listings: 0 }).eq("id", id);
        })
      );
    }
    console.log(`  Zeroed ${toZero.length} brokers`);
  }
} else {
  console.log("  Done");
}

// Step 4: Update agencies
console.log("\nStep 4: Updating agency stats...");
const { data: agencyBrokers } = await sb.from("brokers").select("id, agency_id, active_listings");
if (agencyBrokers) {
  const agencyStats = {};
  for (const b of agencyBrokers) {
    if (!b.agency_id) continue;
    const s = (agencyStats[b.agency_id] ??= { brokers: 0, listings: 0 });
    s.brokers++;
    s.listings += b.active_listings || 0;
  }

  const agencyIds = Object.keys(agencyStats);
  let agencyUpdated = 0;
  for (let i = 0; i < agencyIds.length; i += BATCH) {
    const batch = agencyIds.slice(i, i + BATCH);
    await Promise.all(
      batch.map(async (agencyId) => {
        const stats = agencyStats[agencyId];
        const { error } = await sb
          .from("agencies")
          .update({ total_brokers: stats.brokers, total_listings: stats.listings })
          .eq("id", agencyId);
        if (!error) agencyUpdated++;
      })
    );
  }
  console.log(`  Updated ${agencyUpdated} agencies`);
}

console.log("\nDone!");
