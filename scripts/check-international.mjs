import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const envPath = resolve(ROOT, ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

// Total count
const { count: total } = await sb.from("properties").select("id", { count: "exact", head: true }).eq("active", true);
console.log("Total active properties:", total);

// By source
const { data: all } = await sb.from("properties").select("source, country").eq("active", true);
const bySource = {};
const byCountry = {};
for (const r of all || []) {
  const s = r.source || "sreality";
  const c = r.country || "cz";
  bySource[s] = (bySource[s] || 0) + 1;
  byCountry[c] = (byCountry[c] || 0) + 1;
}
console.log("By source:", bySource);
console.log("By country:", byCountry);

// Belgian sample
const { data: beSample } = await sb.from("properties").select("title, city, price, price_currency, country, source, images").eq("source", "immoweb").limit(3);
console.log("\nBelgian properties sample:");
for (const p of beSample || []) {
  console.log(`  - ${p.title} | ${p.city} | ${p.price} ${p.price_currency} | imgs: ${p.images?.length || 0}`);
}
