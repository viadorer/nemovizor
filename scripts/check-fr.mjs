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

const { data, error } = await sb.from("properties").select("id, title, city, price, price_currency, image_src, images, latitude, longitude").eq("price_currency", "eur").order("created_at", { ascending: false }).limit(5);
if (error) { console.error(error); process.exit(1); }
data.forEach(p => {
  console.log("---");
  console.log("Title:", p.title);
  console.log("City:", p.city, "| Price: EUR", p.price);
  console.log("Coords:", p.latitude, p.longitude);
  console.log("image_src:", (p.image_src || "").slice(0, 100));
  console.log("images count:", (p.images || []).length, "| urls:", (p.images || []).map(u => u.slice(0, 60)));
});
