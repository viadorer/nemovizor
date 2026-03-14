import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "fs";

const env = readFileSync(".env.local", "utf8").split("\n").reduce((a, l) => {
  const m = l.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m) a[m[1]] = m[2];
  return a;
}, {});

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

// Delete all agencies and brokers — scraper will re-create with correct names
console.log("Deleting all brokers...");
const { data: brokers } = await sb.from("brokers").select("id");
for (const b of (brokers || [])) {
  await sb.from("brokers").delete().eq("id", b.id);
  process.stdout.write(".");
}
console.log(` ${(brokers || []).length}`);

console.log("Deleting all agencies...");
const { data: agencies } = await sb.from("agencies").select("id");
for (const a of (agencies || [])) {
  await sb.from("agencies").delete().eq("id", a.id);
  process.stdout.write(".");
}
console.log(` ${(agencies || []).length}`);

// Reset state
writeFileSync("scripts/.scrape-state.json", JSON.stringify({ seen: {}, stats: { properties: 0, agencies: 0, brokers: 0, images: 0 } }));
console.log("State reset. Ready for fresh scrape.");
