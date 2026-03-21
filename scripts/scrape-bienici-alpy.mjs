#!/usr/bin/env node
// ============================================================
// Bienici.com Scraper — French Alps
// Educational / study purposes only
// Fetches global results sorted by price desc, filters client-side
// for Alpine departments: 73 (Savoie), 74 (Haute-Savoie),
// 38 (Isère), 05 (Hautes-Alpes), 04 (Alpes-de-Haute-Provence)
// Usage: node scripts/scrape-bienici-alpy.mjs [--pages 100] [--delay 800] [--offset 0]
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

const PAGES = Number(getArg("--pages", "100"));
const DELAY_MS = Number(getArg("--delay", "800"));
const PAGE_OFFSET = Number(getArg("--offset", "0"));
const PER_PAGE = 24;
const MAX_IMAGES = 6;
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";
const BASE = "https://www.bienici.com/realEstateAds.json";

// French Alps postal code prefixes
// 73 = Savoie (Courchevel, Méribel, Val Thorens, Chambéry)
// 74 = Haute-Savoie (Chamonix, Megève, Annecy, Morzine)
// 38 = Isère (Grenoble, Alpe d'Huez, Les Deux Alpes)
// 05 = Hautes-Alpes (Serre Chevalier, Briançon)
// 04 = Alpes-de-Haute-Provence (Barcelonnette, Pra-Loup)
const ALPS_PREFIXES = ["73", "74", "38", "05", "04"];

function isAlps(postalCode) {
  if (!postalCode) return false;
  return ALPS_PREFIXES.some(p => postalCode.startsWith(p));
}

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
const STATE_FILE = resolve(ROOT, "scripts/.scrape-bienici-alpy-state.json");
function loadState() {
  try { return JSON.parse(readFileSync(STATE_FILE, "utf8")); }
  catch { return { seen: {}, stats: { properties: 0, images: 0, skipped: 0, filtered: 0 } }; }
}
function saveState(state) { writeFileSync(STATE_FILE, JSON.stringify(state, null, 2)); }

// ===== Helpers =====
function slugify(t) {
  return t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
}
async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function mapPropertyType(t) {
  const map = { flat: "apartment", house: "house", loft: "apartment", castle: "house", parking: "other", programme: "apartment", land: "land" };
  return map[t] || "other";
}

function mapAdType(t) {
  return t === "rent" ? "rent" : "sale";
}

// ===== R2 Upload =====
async function uploadToR2(imageUrl, slug) {
  if (!r2) return null;
  try {
    const resp = await fetch(imageUrl, {
      headers: { "User-Agent": UA, "Referer": "https://www.bienici.com/" },
      redirect: "follow",
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) return null;
    const buf = Buffer.from(await resp.arrayBuffer());
    if (buf.byteLength < 500) return null;

    const key = `uploads/images/${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${slug.slice(0, 40)}.jpg`;
    await r2.send(new PutObjectCommand({
      Bucket: R2_BUCKET_NAME, Key: key, Body: buf,
      ContentType: "image/jpeg",
      CacheControl: "public, max-age=31536000, immutable",
    }));
    return R2_PUBLIC_URL ? `${R2_PUBLIC_URL}/${key}` : key;
  } catch { return null; }
}

// ===== Geocode by city name (fallback for missing coords) =====
const geoCache = new Map();
async function geocodeCity(city, postalCode) {
  const key = `${city}-${postalCode || ""}`;
  if (geoCache.has(key)) return geoCache.get(key);
  try {
    const q = encodeURIComponent(`${city} ${postalCode || ""} France`);
    const resp = await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`, {
      headers: { "User-Agent": "Nemovizor/1.0 (educational)" },
      signal: AbortSignal.timeout(5000),
    });
    if (!resp.ok) { geoCache.set(key, null); return null; }
    const data = await resp.json();
    if (data[0]?.lat && data[0]?.lon) {
      const result = { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
      geoCache.set(key, result);
      return result;
    }
  } catch {}
  geoCache.set(key, null);
  return null;
}

// ===== Insert Property =====
async function insertProperty(ad, r2Images) {
  const id = ad.id;
  const title = ad.title || `${ad.propertyType === "flat" ? "Appartement" : "Maison"} ${ad.roomsQuantity || ""}p - ${ad.city}`;
  const city = ad.city || "Nice";
  const district = ad.district?.name || ad.displayDistrictName || city;
  const rawPrice = ad.price;
  const price = Array.isArray(rawPrice) ? rawPrice[0] : (typeof rawPrice === "number" ? rawPrice : parseFloat(rawPrice) || 0);

  if (price < 1000 && mapAdType(ad.adType) === "sale") return { skipped: true };
  if (price > 120000000) return { skipped: true };

  const slug = slugify(title + "-" + city + "-bn" + id.replace(/[^a-z0-9]/gi, "").slice(-8));

  // Dedup by title+city (same property listed by multiple agencies, possibly different price)
  const { data: dup } = await sb.from("properties").select("id").eq("title", title).eq("city", city).maybeSingle();
  if (dup) return { skipped: true };
  const { data: dup2 } = await sb.from("properties").select("id").eq("slug", slug).maybeSingle();
  if (dup2) return { skipped: true };

  const desc = (ad.description || "").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").trim();
  let lat = ad.blurInfo?.position?.lat || ad.blurInfo?.centroid?.lat;
  let lng = ad.blurInfo?.position?.lon || ad.blurInfo?.position?.lng || ad.blurInfo?.centroid?.lon;
  if (!lat || !lng) {
    const geo = await geocodeCity(city, ad.postalCode);
    if (geo) { lat = geo.lat; lng = geo.lon; }
    else return { skipped: true };
  }
  const rawArea = ad.surfaceArea;
  const area = Array.isArray(rawArea) ? rawArea[0] : (typeof rawArea === "number" ? rawArea : parseFloat(rawArea) || 0);
  if (!r2Images.length) return { skipped: true };

  const property = {
    slug,
    title,
    listing_type: mapAdType(ad.adType),
    category: mapPropertyType(ad.propertyType),
    subtype: ad.propertyType === "flat" ? "atypicky" : "rodinny",
    rooms_label: ad.roomsQuantity ? `${ad.roomsQuantity} pieces` : undefined,
    price,
    price_currency: "eur",
    price_unit: mapAdType(ad.adType) === "rent" ? "za_mesic" : undefined,
    city,
    district,
    location_label: `${district}, ${city} ${ad.postalCode || ""}`.trim(),
    latitude: lat,
    longitude: lng,
    area: typeof area === "number" ? area : parseFloat(area) || 0,
    summary: (desc.slice(0, 300).replace(/\n/g, " ").trim()) || title,
    description: desc || undefined,
    elevator: ad.hasElevator || false,
    cellar: ad.hasCellar || false,
    terrace: ad.hasTerrace || false,
    pool: ad.hasPool || false,
    balcony: ad.hasBalcony || false,
    garden: ad.hasGarden || false,
    garage: ad.hasParking || false,
    image_src: r2Images[0],
    image_alt: title,
    images: r2Images,
    featured: false,
    active: true,
    country: "fr",
  };

  const { error } = await sb.from("properties").insert(property);
  if (error) {
    if (error.code === "23505") return { skipped: true };
    throw new Error(error.message);
  }
  return { skipped: false };
}

// ===== Main =====
async function main() {
  console.log(`
  Bienici.com ALPS Scraper | Pages: ${PAGES} | Offset: ${PAGE_OFFSET} | Delay: ${DELAY_MS}ms
  Filter: French Alps (73 Savoie, 74 Haute-Savoie, 38 Isere, 05 Hautes-Alpes, 04 AHP)
  Scanning global results, keeping only Alpine properties
`);

  const state = loadState();
  if (!state.stats.filtered) state.stats.filtered = 0;
  const t0 = Date.now();

  const searches = [
    { type: "buy", prop: ["flat"], label: "Achat appartements" },
    { type: "buy", prop: ["house"], label: "Achat maisons" },
    { type: "rent", prop: ["flat"], label: "Location appartements" },
    { type: "rent", prop: ["house"], label: "Location maisons" },
  ];

  const pps = Math.ceil(PAGES / searches.length);

  for (const search of searches) {
    console.log(`\n== ${search.label} (${pps} pages) ==`);

    for (let page = 0; page < pps; page++) {
      const from = (page + PAGE_OFFSET) * PER_PAGE;
      const filters = {
        size: PER_PAGE,
        from,
        filterType: search.type,
        propertyType: search.prop,
        minPrice: search.type === "buy" ? 30000 : 300,
        maxPrice: search.type === "buy" ? 120000000 : 30000,
        sortBy: "price",
        sortOrder: "desc",
      };

      let ads;
      try {
        const url = `${BASE}?filters=${encodeURIComponent(JSON.stringify(filters))}`;
        const resp = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(15000) });
        if (!resp.ok) { console.error(`  HTTP ${resp.status}`); await sleep(3000); continue; }
        const data = await resp.json();
        ads = data.realEstateAds || [];
      } catch (e) {
        console.error(`  Fetch error: ${e.message}`);
        await sleep(3000);
        continue;
      }

      if (!ads.length) { console.log("  Empty, next search"); break; }

      // Filter to Alps only
      const rivieraAds = ads.filter(ad => isAlps(ad.postalCode));
      const nonAlps = ads.length - rivieraAds.length;
      state.stats.filtered += nonAlps;

      console.log(`\n  Page ${page + 1}/${pps} — ${rivieraAds.length}/${ads.length} Alps`);

      for (const ad of rivieraAds) {
        if (state.seen[`bn-${ad.id}`]) { process.stdout.write("s"); continue; }

        try {
          await sleep(DELAY_MS);

          const photos = (ad.photos || []).slice(0, MAX_IMAGES);
          const r2Urls = [];
          const imgSlug = slugify(ad.city || "alpes");
          for (const photo of photos) {
            const urls = [photo.url, photo.url_photo].filter(Boolean);
            let r2Url = null;
            for (const u of urls) {
              r2Url = await uploadToR2(u, imgSlug);
              if (r2Url) break;
            }
            if (r2Url) { r2Urls.push(r2Url); state.stats.images++; }
          }

          const res = await insertProperty(ad, r2Urls);
          if (res.skipped) { state.stats.skipped++; process.stdout.write("d"); }
          else { state.stats.properties++; process.stdout.write("."); }

          state.seen[`bn-${ad.id}`] = true;
          if (state.stats.properties % 5 === 0) saveState(state);
        } catch (e) {
          console.error(`\n  Err ${ad.id}: ${e.message}`);
          process.stdout.write("x");
        }
      }

      const min = ((Date.now() - t0) / 60000).toFixed(1);
      console.log(`  [${min}m] P:${state.stats.properties} I:${state.stats.images} S:${state.stats.skipped} F:${state.stats.filtered}`);
      saveState(state);
    }
  }

  saveState(state);
  const totalMin = ((Date.now() - t0) / 60000).toFixed(1);
  console.log(`\n  DONE in ${totalMin}m | Alps Props: ${state.stats.properties} | Images: ${state.stats.images} | Filtered out: ${state.stats.filtered}\n`);
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
