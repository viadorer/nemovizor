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

// Check if source/country columns exist
const { data, error } = await sb.from("properties").select("id, source, country").limit(1);
if (error) {
  console.log("NEED_MIGRATION:", error.message);
  // Try to add columns via SQL
  console.log("Attempting to add columns...");
  const { error: e1 } = await sb.rpc("query", { query_text: "ALTER TABLE properties ADD COLUMN IF NOT EXISTS source TEXT; ALTER TABLE properties ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'cz';" });
  if (e1) console.log("RPC failed:", e1.message, "- Run migration manually in Supabase dashboard");
} else {
  console.log("COLUMNS_OK:", JSON.stringify(data));
}

// Check if gbp currency exists
const { data: d2, error: e2 } = await sb.from("properties").select("id").eq("price_currency", "gbp").limit(0);
if (e2 && e2.message.includes("invalid input value")) {
  console.log("NEED_GBP_ENUM - Run: ALTER TYPE price_currency ADD VALUE 'gbp';");
} else {
  console.log("GBP_ENUM_OK");
}
