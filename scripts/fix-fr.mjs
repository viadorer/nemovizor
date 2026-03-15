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

// Delete French properties with insane prices (>120M EUR)
const { data: bad, error: e1 } = await sb.from("properties").select("id, title, price").eq("price_currency", "eur").gt("price", 120000000);
console.log("Found", bad?.length, "properties with price > 120M EUR");
if (bad && bad.length > 0) {
  bad.forEach(p => console.log("  DELETE:", p.title, "EUR", p.price));
  const ids = bad.map(p => p.id);
  const { error } = await sb.from("properties").delete().in("id", ids);
  if (error) console.error("Delete error:", error);
  else console.log("Deleted", ids.length, "bad records");
}

// Delete properties with fallback longitude (2.35)
const { data: badCoords } = await sb.from("properties").select("id").eq("price_currency", "eur").eq("longitude", 2.35);
console.log("\nProperties with fallback longitude (2.35):", badCoords?.length);
if (badCoords && badCoords.length > 0) {
  const { error: e2 } = await sb.from("properties").delete().eq("price_currency", "eur").eq("longitude", 2.35);
  if (e2) console.error("Delete error:", e2);
  else console.log("Deleted", badCoords.length, "bad-coord records");
}
