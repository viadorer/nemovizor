import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "fs";

const env = readFileSync(".env.local", "utf8").split("\n").reduce((a, l) => {
  const m = l.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m) a[m[1]] = m[2];
  return a;
}, {});

const sb = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// 1. Delete properties with "srundefined" slug or old imports without -sr suffix
const { data: props } = await sb.from("properties").select("id, slug, title, images");
const toDelete = props.filter(p => {
  if (p.slug && p.slug.includes("srundefined")) return true;
  // Old imports without -sr{number} suffix — they have duplicate data
  if (p.slug && p.slug.indexOf("-sr") === -1) return true;
  return false;
});

console.log("Properties to delete:", toDelete.length, "of", props.length);
let deleted = 0;
for (const p of toDelete) {
  const { error } = await sb.from("properties").delete().eq("id", p.id);
  if (error) console.error("  err:", p.slug, error.message);
  else { deleted++; process.stdout.write("."); }
}
console.log("\nDeleted:", deleted);

// 2. Delete seed brokers/agencies
const { data: brokers } = await sb.from("brokers").select("id, slug, name");
const seedBrokers = brokers.filter(b => b.slug && (b.slug.startsWith("00000000") || b.slug.includes("srundefined")));
if (seedBrokers.length) {
  console.log("\nSeed/bad brokers to delete:", seedBrokers.length);
  for (const b of seedBrokers) {
    await sb.from("brokers").delete().eq("id", b.id);
    process.stdout.write(".");
  }
  console.log("");
}

const { data: agencies } = await sb.from("agencies").select("id, slug, name");
const seedAgencies = agencies.filter(a => a.slug && (a.slug.startsWith("00000000") || a.slug.includes("srundefined")));
if (seedAgencies.length) {
  console.log("Seed/bad agencies to delete:", seedAgencies.length);
  for (const a of seedAgencies) {
    await sb.from("agencies").delete().eq("id", a.id);
    process.stdout.write(".");
  }
  console.log("");
}

// 3. Reset scraper state
writeFileSync("scripts/.scrape-state.json", JSON.stringify({ seen: {}, stats: { properties: 0, agencies: 0, brokers: 0, images: 0 } }));
console.log("Scraper state reset");

// 4. Final counts
const { count: pc } = await sb.from("properties").select("id", { count: "exact", head: true });
const { count: ac } = await sb.from("agencies").select("id", { count: "exact", head: true });
const { count: bc } = await sb.from("brokers").select("id", { count: "exact", head: true });
console.log("\nFinal: Properties:", pc, "| Agencies:", ac, "| Brokers:", bc);
