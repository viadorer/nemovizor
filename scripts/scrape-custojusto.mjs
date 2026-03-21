#!/usr/bin/env node
// ============================================================
// CustoJusto.pt Scraper — Portuguese Real Estate
// Next.js app with __NEXT_DATA__ JSON, no anti-bot protection
// Usage: node scripts/scrape-custojusto.mjs [--pages 20] [--delay 2000]
// ============================================================

import { createClient } from "@supabase/supabase-js";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { readFileSync, existsSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// ===== Config =====
const args = process.argv.slice(2);
function getArg(name, def) {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
}

const PAGES = Number(getArg("--pages", "20"));
const DELAY_MS = Number(getArg("--delay", "2000"));
const MAX_IMAGES = 8;
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

// ===== Load env =====
function loadEnv() {
  const envPath = resolve(ROOT, ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) { console.error("Missing SUPABASE env vars"); process.exit(1); }
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// ===== R2 =====
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID ?? "";
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID ?? "";
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY ?? "";
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME ?? "nemovizor-media";
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL ?? "";
const R2_ENDPOINT = process.env.R2_ENDPOINT || `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

const r2 = (R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY)
  ? new S3Client({ region: "auto", endpoint: R2_ENDPOINT, credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY } })
  : null;
if (!r2) console.warn("WARNING: R2 not configured — images skipped");

// ===== State =====
const STATE_FILE = resolve(ROOT, "scripts/.scrape-state-custojusto.json");
function loadState() {
  try { return JSON.parse(readFileSync(STATE_FILE, "utf8")); }
  catch { return { seen: {}, stats: { properties: 0, images: 0, skipped: 0, errors: 0 } }; }
}
function saveState(state) { writeFileSync(STATE_FILE, JSON.stringify(state, null, 2)); }

// ===== Helpers =====
function slugify(t) {
  return t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
}
async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchPage(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      "Accept": "text/html,application/xhtml+xml",
      "Accept-Language": "pt-PT,pt;q=0.9,en;q=0.5",
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

async function uploadToR2(imageUrl, slug) {
  if (!r2) return null;
  try {
    const resp = await fetch(imageUrl, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) return null;
    const buf = Buffer.from(await resp.arrayBuffer());
    const ext = "jpg";
    const key = `properties/${slug}/${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`;
    await r2.send(new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: buf,
      ContentType: resp.headers.get("content-type") || "image/jpeg",
    }));
    return `${R2_PUBLIC_URL}/${key}`;
  } catch { return null; }
}

// ===== Geocode =====
const geoCache = new Map();
async function geocodeCity(city) {
  if (geoCache.has(city)) return geoCache.get(city);
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city + ", Portugal")}&format=json&limit=1`;
    const res = await fetch(url, { headers: { "User-Agent": "Nemovizor/1.0" }, signal: AbortSignal.timeout(5000) });
    const data = await res.json();
    if (data.length) {
      const result = { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
      geoCache.set(city, result);
      return result;
    }
  } catch {}
  geoCache.set(city, null);
  return null;
}

// ===== Extract listings from __NEXT_DATA__ =====
function extractListings(html) {
  const match = html.match(/<script\s+id="__NEXT_DATA__"\s+type="application\/json">(.*?)<\/script>/s);
  if (!match) return [];
  try {
    const data = JSON.parse(match[1]);
    const items = data?.props?.pageProps?.listItems ?? [];
    return items;
  } catch (e) {
    console.error("  Failed to parse __NEXT_DATA__:", e.message);
    return [];
  }
}

// ===== Search configs =====
const CATEGORIES = [
  { path: "apartamentos", listingType: "sale", category: "apartment", label: "Apartments Sale" },
  { path: "moradias", listingType: "sale", category: "house", label: "Houses Sale" },
  { path: "apartamentos-arrendar", listingType: "rent", category: "apartment", label: "Apartments Rent" },
  { path: "moradias-arrendar", listingType: "rent", category: "house", label: "Houses Rent" },
  { path: "terrenos", listingType: "sale", category: "land", label: "Land" },
  { path: "quintas-e-herdades", listingType: "sale", category: "house", label: "Estates" },
];

// ===== Main =====
async function main() {
  const t0 = Date.now();
  const state = loadState();
  let totalProps = 0, totalImages = 0, totalSkipped = 0, totalErrors = 0;

  console.log(`\n  CustoJusto.pt Scraper | Pages: ${PAGES} | Delay: ${DELAY_MS}ms`);
  console.log(`  Categories: ${CATEGORIES.map(c => c.label).join(", ")}\n`);

  for (const cat of CATEGORIES) {
    console.log(`\n== ${cat.label} (${cat.path}) ==`);

    for (let page = 1; page <= PAGES; page++) {
      try {
        const url = `https://www.custojusto.pt/portugal/${cat.path}?page=${page}`;
        const html = await fetchPage(url);
        const listings = extractListings(html);

        if (!listings.length) {
          console.log(`  Page ${page}: empty, stopping category`);
          break;
        }

        let inserted = 0, skipped = 0;
        for (const item of listings) {
          const listId = String(item.listID || item.id || "");
          if (!listId) continue;

          const stateKey = `cj-${listId}`;
          if (state.seen[stateKey]) { skipped++; totalSkipped++; continue; }

          try {
            const title = item.title || "";
            const price = parseInt(String(item.price || "0").replace(/[^\d]/g, ""), 10) || 0;
            const itemUrl = item.url || "";

            // Location — may be array, string, or object
            let locationNames = item.locationNames || item.location || [];
            if (typeof locationNames === "string") locationNames = locationNames.split(",").map(s => s.trim());
            if (!Array.isArray(locationNames)) locationNames = Object.values(locationNames).filter(v => typeof v === "string");
            const city = locationNames[locationNames.length - 1] || locationNames[1] || "";
            const region = locationNames[1] || locationNames[0] || "";
            const district = locationNames.length > 2 ? locationNames[locationNames.length - 1] : "";

            const slug = slugify(title || `imovel-${listId}`) + `-cj${listId}`;

            // Check for duplicate
            const { data: dup } = await sb.from("properties").select("id").eq("slug", slug).maybeSingle();
            if (dup) { state.seen[stateKey] = true; skipped++; totalSkipped++; continue; }

            // Geocode
            let lat = 0, lon = 0;
            const geoQuery = city || region;
            if (geoQuery) {
              const geo = await geocodeCity(geoQuery);
              if (geo) { lat = geo.lat; lon = geo.lon; }
            }

            // Upload image to R2
            const imgUrl = item.imageFullURL || "";
            const r2Images = [];
            if (imgUrl) {
              const r2Url = await uploadToR2(imgUrl, slug);
              if (r2Url) { r2Images.push(r2Url); totalImages++; }
            }

            const locationLabel = Array.isArray(locationNames) ? locationNames.slice(1).reverse().join(", ") : String(city);
            const property = {
              slug,
              title: title || `Imovel em ${city || "Portugal"}`,
              listing_type: cat.listingType,
              category: cat.category,
              subtype: "ostatni",
              rooms_label: "",
              price,
              price_currency: "eur",
              city: city || region,
              district,
              zip: "",
              region,
              location_label: locationLabel || city || region,
              latitude: lat,
              longitude: lon,
              area: 0,
              summary: (title || "").slice(0, 300),
              image_src: r2Images[0] || (imgUrl || "/branding/placeholder.png"),
              image_alt: title || `Imovel em ${city || "Portugal"}`,
              images: r2Images.length ? r2Images : (imgUrl ? [imgUrl] : []),
              featured: false,
              active: true,
              source: "custojusto",
              country: "pt",
            };

            const { error } = await sb.from("properties").insert(property);
            if (error) {
              if (error.code === "23505") { skipped++; totalSkipped++; }
              else { console.error(`  Err ${listId}: ${error.message}`); totalErrors++; }
            } else {
              inserted++;
              totalProps++;
              process.stdout.write(".");
            }

            state.seen[stateKey] = true;
          } catch (e) {
            console.error(`  Err ${listId}: ${e.message}`);
            totalErrors++;
          }
        }

        if (skipped > 0) process.stdout.write(`s${skipped}`);
        console.log(`\n  Page ${page}: +${inserted} (${skipped} skipped)`);

        saveState(state);
        await sleep(DELAY_MS);
      } catch (e) {
        console.error(`  Page ${page} error: ${e.message}`);
        totalErrors++;
        break;
      }
    }
  }

  const elapsed = ((Date.now() - t0) / 60000).toFixed(1);
  console.log(`\n  DONE in ${elapsed}m | Properties: ${totalProps} | Images: ${totalImages} | Skipped: ${totalSkipped} | Errors: ${totalErrors}\n`);

  state.stats = { properties: totalProps, images: totalImages, skipped: totalSkipped, errors: totalErrors, lastRun: new Date().toISOString() };
  saveState(state);
}

main().catch(e => { console.error("FATAL:", e); process.exit(1); });
