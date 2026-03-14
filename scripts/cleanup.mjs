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

const { data, error } = await sb.from("properties").select("id, title, image_src, slug");
if (error) { console.error(error); process.exit(1); }

const toDelete = data.filter(p => {
  if (!p.image_src) return true;
  if (p.image_src.startsWith("/images/")) return true;
  if (p.image_src === "") return true;
  return false;
});

console.log("Total:", data.length, "| To delete (no R2 images):", toDelete.length);

for (const p of toDelete) {
  const { error: e } = await sb.from("properties").delete().eq("id", p.id);
  if (e) console.error("err:", p.slug, e.message);
  else process.stdout.write(".");
}

console.log("\nDone");
const { count } = await sb.from("properties").select("id", { count: "exact", head: true });
console.log("Remaining properties:", count);
