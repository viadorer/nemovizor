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

// Count by country
const countries = ["cz", "sk", "fr", "de", "pt", "it", "es", "at", "gb", "be", "hr", "hu", "pl"];
for (const c of countries) {
  const { count } = await sb.from("properties").select("id", { count: "exact", head: true }).eq("country", c);
  if (count > 0) console.log(`  ${c.toUpperCase()}: ${count}`);
}
const { count: nullCountry } = await sb.from("properties").select("id", { count: "exact", head: true }).is("country", null);
if (nullCountry > 0) console.log(`  NULL country: ${nullCountry}`);

// Count by source
console.log("\nBy source:");
const sources = ["sreality", "bienici", "kleinanzeigen", "custojusto", "sreality-foreign"];
for (const s of sources) {
  const { count } = await sb.from("properties").select("id", { count: "exact", head: true }).eq("source", s);
  if (count > 0) console.log(`  ${s}: ${count}`);
}
const { count: nullSource } = await sb.from("properties").select("id", { count: "exact", head: true }).is("source", null);
if (nullSource > 0) console.log(`  NULL source: ${nullSource}`);

const { count: total } = await sb.from("properties").select("id", { count: "exact", head: true });
console.log(`\nTotal: ${total}`);
