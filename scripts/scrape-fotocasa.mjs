#!/usr/bin/env node
// ============================================================
// Fotocasa.es Scraper — Spain (coastal + major cities)
// Uses public API: web.gw.fotocasa.es
// Usage: node scripts/scrape-fotocasa.mjs [--delay 800] [--max-pages 20]
// ============================================================

import { createClient } from "@supabase/supabase-js";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { readFileSync, existsSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const args = process.argv.slice(2);
function getArg(name, def) {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
}

const DELAY_MS = Number(getArg("--delay", "800"));
const MAX_PAGES = Number(getArg("--max-pages", "20"));
const MAX_IMAGES = 6;
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const API_BASE = "https://web.gw.fotocasa.es/v2/propertysearch/search";

// === Spanish locations (city-level where possible, province for broader coverage) ===
const LOCATIONS = [
  // Costa del Sol
  { name: "Marbella", id: "724,1,29,320,551,29069,0,0,0" },
  { name: "Estepona", id: "724,1,29,321,555,29051,0,0,0" },
  { name: "Fuengirola", id: "724,1,29,322,559,29054,0,0,0" },
  { name: "Torremolinos", id: "724,1,29,322,557,29901,0,0,0" },
  { name: "Benalmádena", id: "724,1,29,322,560,29025,0,0,0" },
  { name: "Nerja", id: "724,1,29,323,564,29075,0,0,0" },
  { name: "Mijas", id: "724,1,29,322,558,29070,0,0,0" },
  { name: "Rincón de la Victoria", id: "724,1,29,323,563,29082,0,0,0" },
  // Málaga city
  { name: "Málaga", id: "724,1,29,322,561,29067,0,0,0" },
  // Costa Blanca
  { name: "Alicante", id: "724,19,3,361,682,3014,0,0,0" },
  { name: "Benidorm", id: "724,19,3,367,687,3031,0,0,0" },
  { name: "Torrevieja", id: "724,19,3,368,731,3133,0,0,0" },
  { name: "Dénia", id: "724,19,3,366,696,3063,0,0,0" },
  { name: "Jávea", id: "724,19,3,366,706,3082,0,0,0" },
  { name: "Altea", id: "724,19,3,367,684,3018,0,0,0" },
  { name: "Santa Pola", id: "724,19,3,364,728,3121,0,0,0" },
  { name: "Guardamar del Segura", id: "724,19,3,368,703,3076,0,0,0" },
  { name: "Moraira", id: "724,19,3,366,729,3999,0,0,0" },
  // Costa Brava
  { name: "Lloret de Mar", id: "724,9,17,238,419,17095,0,0,0" },
  { name: "Tossa de Mar", id: "724,9,17,238,418,17202,0,0,0" },
  { name: "Roses", id: "724,9,17,245,442,17152,0,0,0" },
  { name: "Cadaqués", id: "724,9,17,245,441,17032,0,0,0" },
  // Major cities
  { name: "Barcelona", id: "724,9,8,11,1,8019,0,0,0" },
  { name: "Madrid", id: "724,14,28,0,0,0,0,0,0" },
  { name: "Valencia", id: "724,19,46,0,0,0,0,0,0" },
  { name: "Sevilla", id: "724,1,41,0,0,0,0,0,0" },
  // Balearic Islands
  { name: "Palma de Mallorca", id: "724,4,7,223,316,7040,0,0,0" },
  { name: "Baleares", id: "724,4,7,0,0,0,0,0,0" },
  // Canary Islands
  { name: "Tenerife", id: "724,5,38,0,0,0,0,0,0" },
  { name: "Las Palmas", id: "724,5,35,0,0,0,0,0,0" },
  // Cádiz coast
  { name: "Cádiz", id: "724,1,11,0,0,0,0,0,0" },
  // Almería coast
  { name: "Almería", id: "724,1,4,0,0,0,0,0,0" },
  // North coast
  { name: "Cantabria", id: "724,6,39,0,0,0,0,0,0" },
  { name: "A Coruña", id: "724,12,15,0,0,0,0,0,0" },
  { name: "Pontevedra", id: "724,12,36,0,0,0,0,0,0" },
  { name: "Asturias", id: "724,3,33,0,0,0,0,0,0" },
  { name: "Guipúzcoa", id: "724,18,20,0,0,0,0,0,0" },
  // Huelva coast
  { name: "Huelva", id: "724,1,21,0,0,0,0,0,0" },
  // Inland gems
  { name: "Granada", id: "724,1,18,0,0,0,0,0,0" },
  { name: "Córdoba", id: "724,1,14,0,0,0,0,0,0" },
  { name: "Bilbao", id: "724,18,48,420,791,48020,0,0,0" },
  { name: "Santander", id: "724,6,39,472,966,39075,0,0,0" },
];

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
const STATE_FILE = resolve(ROOT, "scripts/.scrape-state-fotocasa.json");
function loadState() {
  try { return JSON.parse(readFileSync(STATE_FILE, "utf8")); }
  catch { return { seen: {}, stats: { properties: 0, images: 0, skipped: 0 }, completedLocations: [] }; }
}
function saveState(state) { writeFileSync(STATE_FILE, JSON.stringify(state, null, 2)); }

function slugify(t) {
  return t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
}
async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function getFeature(features, key) {
  const f = (features || []).find(x => x.key === key);
  return f?.value?.[0] ?? null;
}

function mapPropertyType(typeId) {
  // fotocasa: 2=flat, 1=house, 3=land, 6=commercial, etc.
  const map = { 2: "apartment", 1: "house", 3: "land", 6: "other", 4: "other", 5: "other" };
  return map[typeId] || "other";
}

// ===== R2 Upload =====
async function uploadToR2(imageUrl, slug) {
  if (!r2) return null;
  try {
    const resp = await fetch(imageUrl, {
      headers: { "User-Agent": UA, "Referer": "https://www.fotocasa.es/" },
      redirect: "follow", signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) return null;
    const buf = Buffer.from(await resp.arrayBuffer());
    if (buf.byteLength < 500) return null;
    const key = `uploads/images/${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${slug.slice(0, 40)}.jpg`;
    await r2.send(new PutObjectCommand({
      Bucket: R2_BUCKET_NAME, Key: key, Body: buf,
      ContentType: "image/jpeg", CacheControl: "public, max-age=31536000, immutable",
    }));
    return R2_PUBLIC_URL ? `${R2_PUBLIC_URL}/${key}` : key;
  } catch { return null; }
}

// ===== Insert Property =====
async function insertProperty(ad, r2Images) {
  const id = ad.id || ad.realEstateAdId;
  const features = ad.features || [];
  const surface = getFeature(features, "surface") || 0;
  const rooms = getFeature(features, "rooms") || 0;
  const bathrooms = getFeature(features, "bathrooms") || 0;
  const hasElevator = getFeature(features, "elevator") === 1;
  const hasPool = getFeature(features, "swimming_pool") === 1;
  const hasBalcony = getFeature(features, "balcony") === 1;
  const hasTerrace = getFeature(features, "terrace") === 1;
  const hasGarden = getFeature(features, "garden") === 1;
  const hasGarage = getFeature(features, "garage") === 1 || getFeature(features, "parking") === 1;

  const price = ad.transactions?.[0]?.value?.[0] || 0;
  const transType = ad.transactions?.[0]?.transactionTypeId;
  const listingType = transType === 3 ? "rent" : "sale";

  if (price < 1000 && listingType === "sale") return { skipped: true };
  if (price > 120000000) return { skipped: true };

  const addr = ad.address || {};
  const loc = addr.location || {};
  const city = loc.level5 || loc.level4 || loc.level3 || loc.level2 || "";
  const district = loc.level7 || loc.level6 || "";
  const region = loc.level1 || "";
  const desc = (ad.description || "").trim();
  const title = desc.slice(0, 120) || `Vivienda ${rooms}hab - ${city}`;

  const slug = slugify(title + "-" + city + "-fc" + id);

  const { data: dup } = await sb.from("properties").select("id").eq("slug", slug).maybeSingle();
  if (dup) return { skipped: true };

  const lat = addr.coordinates?.latitude || 0;
  const lng = addr.coordinates?.longitude || 0;
  if (!lat || !lng) return { skipped: true };
  if (!r2Images.length) return { skipped: true };

  const locationParts = [district, city, loc.level2].filter(Boolean);
  const property = {
    slug,
    title,
    listing_type: listingType,
    category: mapPropertyType(ad.typeId),
    subtype: ad.subtypeId === 1 ? "atypicky" : "rodinny",
    rooms_label: rooms ? `${rooms} hab.` : undefined,
    price,
    price_currency: "eur",
    price_unit: listingType === "rent" ? "za_mesic" : undefined,
    city,
    district,
    region,
    location_label: locationParts.join(", "),
    latitude: lat,
    longitude: lng,
    area: surface,
    summary: desc.slice(0, 300) || title,
    description: desc || undefined,
    elevator: hasElevator,
    cellar: false,
    terrace: hasTerrace,
    pool: hasPool,
    balcony: hasBalcony,
    garden: hasGarden,
    garage: hasGarage,
    image_src: r2Images[0],
    image_alt: title,
    images: r2Images,
    featured: false,
    active: true,
    source: "fotocasa",
    country: "es",
  };

  const { error } = await sb.from("properties").insert(property);
  if (error) {
    if (error.code === "23505") return { skipped: true };
    throw new Error(error.message);
  }
  return { skipped: false };
}

// ===== Fetch Page =====
async function fetchPage(locationId, pageNum, transactionTypeId = 1) {
  const params = new URLSearchParams({
    combinedLocationIds: locationId,
    culture: "es-ES",
    isMap: "false",
    isNewConstructionPromotions: "false",
    pageNumber: String(pageNum),
    platformId: "1",
    propertyTypeId: "2",
    transactionTypeId: String(transactionTypeId),
    sortOrderDesc: "true",
    sortType: "scoring",
  });
  const url = `${API_BASE}?${params}`;
  const resp = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(15000) });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const data = await resp.json();
  return { total: data.count || 0, ads: data.realEstates || [] };
}

// ===== Main =====
async function main() {
  console.log(`\n  Fotocasa.es SPAIN Scraper — ${LOCATIONS.length} locations | MaxPages: ${MAX_PAGES} | Delay: ${DELAY_MS}ms\n`);
  const state = loadState();
  const t0 = Date.now();
  let newProps = 0, newImages = 0, skipped = 0;

  for (const loc of LOCATIONS) {
    const locKey = loc.id;
    if (state.completedLocations?.includes(locKey)) {
      console.log(`\n  [skip] ${loc.name} — already completed`);
      continue;
    }

    // Only sale (transactionTypeId=1) for now
    console.log(`\n== ${loc.name} ==`);
    let page = 1;
    while (page <= MAX_PAGES) {
      let result;
      try { result = await fetchPage(loc.id, page); }
      catch (e) { console.error(`  Fetch error p${page}: ${e.message}`); break; }

      if (!result.ads.length) { console.log(`  No more results (total: ${result.total})`); break; }
      console.log(`\n  Page ${page}/${MAX_PAGES} — ${result.ads.length} ads (total: ${result.total})`);

      for (const ad of result.ads) {
        const adId = ad.id || ad.realEstateAdId;
        if (state.seen[`fc-${adId}`]) { process.stdout.write("s"); skipped++; continue; }
        try {
          await sleep(DELAY_MS);
          const photos = (ad.multimedias || []).filter(m => m.url).slice(0, MAX_IMAGES);
          const r2Urls = [];
          const imgSlug = slugify(loc.name);
          for (const photo of photos) {
            const imgUrl = photo.url;
            if (!imgUrl) continue;
            const r2Url = await uploadToR2(imgUrl, imgSlug);
            if (r2Url) { r2Urls.push(r2Url); newImages++; state.stats.images++; }
          }
          const res = await insertProperty(ad, r2Urls);
          if (res.skipped) { state.stats.skipped++; process.stdout.write("d"); }
          else { newProps++; state.stats.properties++; process.stdout.write("."); }
          state.seen[`fc-${adId}`] = true;
          if (newProps % 5 === 0) saveState(state);
        } catch (e) {
          console.error(`\n  Err ${adId}: ${e.message}`);
          process.stdout.write("x");
        }
      }
      const min = ((Date.now() - t0) / 60000).toFixed(1);
      console.log(`  [${min}m] new:${newProps} img:${newImages} skip:${skipped}`);
      saveState(state);
      page++;
    }

    if (!state.completedLocations) state.completedLocations = [];
    state.completedLocations.push(locKey);
    saveState(state);
  }

  saveState(state);
  const totalMin = ((Date.now() - t0) / 60000).toFixed(1);
  console.log(`\n  DONE in ${totalMin}m | New props: ${newProps} | New images: ${newImages} | Skipped: ${skipped}\n`);
}
main().catch(e => { console.error("Fatal:", e); process.exit(1); });
