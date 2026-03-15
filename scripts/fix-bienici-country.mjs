#!/usr/bin/env node
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

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const { count } = await sb.from("properties").select("id", { count: "exact", head: true }).is("country", null);
console.log("Properties with null country:", count);

if (count > 0) {
  // Update in batches of 1000
  let updated = 0;
  while (true) {
    const { data, error } = await sb.from("properties").update({ source: "bienici", country: "fr" }).is("source", null).limit(1000).select("id");
    if (error) { console.error("Error:", error.message); break; }
    if (!data?.length) break;
    updated += data.length;
    console.log(`  Updated ${updated} so far...`);
  }
  console.log(`Total updated: ${updated}`);
} else {
  console.log("Nothing to update");
}
