import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const env = readFileSync(".env.local", "utf8").split("\n").reduce((a, l) => {
  const m = l.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m) a[m[1]] = m[2];
  return a;
}, {});

const sb = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const { data: props } = await sb.from("properties").select("id, slug, title, image_src, images");
console.log("Total properties:", props.length);

const withR2 = props.filter(p => p.image_src && p.image_src.includes("r2.dev"));
const withSr = props.filter(p => p.slug && p.slug.includes("-sr"));
const noSr = props.filter(p => p.slug && p.slug.indexOf("-sr") === -1);
console.log("With R2 images:", withR2.length);
console.log("With -sr slug (new scraper):", withSr.length);
console.log("Without -sr slug (old imports):", noSr.length);

console.log("\nOld imports (first 5):");
noSr.slice(0, 5).forEach(p => {
  const imgCount = Array.isArray(p.images) ? p.images.length : 0;
  console.log("  ", p.slug, "|", imgCount, "imgs |", (p.image_src || "").slice(0, 50));
});

console.log("\nNew scraper (first 5):");
withSr.slice(0, 5).forEach(p => {
  const imgCount = Array.isArray(p.images) ? p.images.length : 0;
  console.log("  ", p.slug, "|", imgCount, "imgs |", (p.image_src || "").slice(0, 50));
});

const { count: agCount } = await sb.from("agencies").select("id", { count: "exact", head: true });
const { count: brCount } = await sb.from("brokers").select("id", { count: "exact", head: true });
console.log("\nAgencies:", agCount, "| Brokers:", brCount);
