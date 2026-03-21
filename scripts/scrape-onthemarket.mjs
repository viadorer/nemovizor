#!/usr/bin/env node
// ============================================================
// OnTheMarket.com Scraper (UK)
// Educational / study purposes only
// Properties + R2 images → Supabase
// Usage: node scripts/scrape-onthemarket.mjs [--pages 10] [--delay 2000]
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

const PAGES_PER_LOCATION = Number(getArg("--pages", "5"));
const DELAY_MS = Number(getArg("--delay", "2000"));
const MAX_IMAGES = 6;
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";
const BASE = "https://www.onthemarket.com/async/search/properties/";

// UK locations to scrape
const LOCATIONS = [
  // Major cities
  { id: "london", label: "London" },
  { id: "manchester", label: "Manchester" },
  { id: "birmingham", label: "Birmingham" },
  { id: "edinburgh", label: "Edinburgh" },
  { id: "bristol", label: "Bristol" },
  { id: "liverpool", label: "Liverpool" },
  { id: "leeds", label: "Leeds" },
  { id: "glasgow", label: "Glasgow" },
  // Desirable areas
  { id: "oxford", label: "Oxford" },
  { id: "cambridge", label: "Cambridge" },
  { id: "bath", label: "Bath" },
  { id: "brighton", label: "Brighton" },
  { id: "york", label: "York" },
  { id: "windsor", label: "Windsor" },
  // Countryside / coast
  { id: "cornwall", label: "Cornwall" },
  { id: "cotswolds", label: "Cotswolds" },
  { id: "lake-district", label: "Lake District" },
  { id: "surrey", label: "Surrey" },
  { id: "hampshire", label: "Hampshire" },
  { id: "devon", label: "Devon" },
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
const STATE_FILE = resolve(ROOT, "scripts/.scrape-onthemarket-state.json");
function loadState() {
  try { return JSON.parse(readFileSync(STATE_FILE, "utf8")); }
  catch { return { seen: {}, stats: { properties: 0, images: 0, skipped: 0 } }; }
}
function saveState(state) { writeFileSync(STATE_FILE, JSON.stringify(state, null, 2)); }

// ===== Helpers =====
function slugify(t) {
  return t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
}
async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function parsePrice(priceStr) {
  if (!priceStr) return 0;
  // "£465,000" → 465000, convert to EUR (approx 1.17)
  const num = parseFloat(priceStr.replace(/[^0-9.]/g, ""));
  return isNaN(num) ? 0 : Math.round(num * 1.17);
}

function parsePriceGBP(priceStr) {
  if (!priceStr) return 0;
  return parseFloat(priceStr.replace(/[^0-9.]/g, "")) || 0;
}

function mapPropertyType(title) {
  const t = (title || "").toLowerCase();
  if (t.includes("flat") || t.includes("apartment") || t.includes("penthouse") || t.includes("studio")) return "apartment";
  if (t.includes("house") || t.includes("cottage") || t.includes("bungalow") || t.includes("villa") || t.includes("detached") || t.includes("semi-detached") || t.includes("terraced")) return "house";
  if (t.includes("land") || t.includes("plot")) return "land";
  return "other";
}

// ===== R2 Upload =====
async function uploadToR2(imageUrl, slug) {
  if (!r2) return null;
  try {
    // Get higher res version
    const hiRes = imageUrl.replace("480x320", "1024x768");
    const resp = await fetch(hiRes, {
      headers: { "User-Agent": UA, "Referer": "https://www.onthemarket.com/" },
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

// ===== Insert Property =====
async function insertProperty(prop, locationLabel, r2Images) {
  const id = prop.id;
  const title = prop["property-title"] || "Property in " + locationLabel;
  const address = prop.display_address || locationLabel;
  const city = prop["address-locality"] || locationLabel;
  const slug = slugify(title + "-" + address) + `-otm${id}`.slice(0, 20);

  // Dedup
  const { data: dup } = await sb.from("properties").select("id").eq("slug", slug).maybeSingle();
  if (dup) return { skipped: true };

  const lat = prop.location?.lat;
  const lng = prop.location?.lon;
  if (!lat || !lng) return { skipped: true };

  const priceGBP = parsePriceGBP(prop.price);
  const priceEUR = parsePrice(prop.price);
  if (priceGBP < 10000 || priceGBP > 100000000) return { skipped: true };
  if (!r2Images.length) return { skipped: true };

  const features = (prop.features || []).join(". ");
  const bedroomsText = prop["bedrooms-text"] || "";
  const category = mapPropertyType(title);

  const isSale = prop["for-sale?"] !== false;

  const property = {
    slug,
    title,
    listing_type: isSale ? "sale" : "rent",
    category,
    subtype: category === "apartment" ? "atypicky" : "rodinny",
    rooms_label: bedroomsText ? `${bedroomsText} bedrooms` : undefined,
    price: priceEUR,
    price_currency: "eur",
    price_unit: isSale ? undefined : "za_mesic",
    city,
    district: address,
    location_label: address,
    latitude: lat,
    longitude: lng,
    area: 0,
    summary: features.slice(0, 300) || title,
    description: features || undefined,
    elevator: false,
    cellar: false,
    terrace: false,
    pool: false,
    balcony: false,
    garden: features.toLowerCase().includes("garden"),
    garage: features.toLowerCase().includes("garage") || features.toLowerCase().includes("parking"),
    image_src: r2Images[0],
    image_alt: title,
    images: r2Images,
    featured: false,
    active: true,
    country: "gb",
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
  OnTheMarket.com UK Scraper | ${LOCATIONS.length} locations | ${PAGES_PER_LOCATION} pages/loc | Delay: ${DELAY_MS}ms
`);

  const state = loadState();
  const t0 = Date.now();

  const searchTypes = [
    { type: "for-sale", label: "Sale" },
    { type: "to-rent", label: "Rent" },
  ];

  for (const location of LOCATIONS) {
    for (const searchType of searchTypes) {
      console.log(`\n== ${location.label} — ${searchType.label} ==`);

      for (let page = 1; page <= PAGES_PER_LOCATION; page++) {
        const params = new URLSearchParams({
          "search-type": searchType.type,
          "location-id": location.id,
          page: String(page),
          "sort-field": "price",
          "sort-order": "desc",
        });

        let properties;
        try {
          const url = `${BASE}?${params}`;
          const resp = await fetch(url, {
            headers: { "User-Agent": UA },
            signal: AbortSignal.timeout(15000),
          });
          if (!resp.ok) { console.error(`  HTTP ${resp.status}`); await sleep(3000); continue; }
          const data = await resp.json();
          properties = data.properties || [];
        } catch (e) {
          console.error(`  Fetch error: ${e.message}`);
          await sleep(3000);
          continue;
        }

        if (!properties.length) { console.log(`  Empty page ${page}`); break; }

        console.log(`\n  Page ${page}/${PAGES_PER_LOCATION} (${properties.length} props)`);

        for (const prop of properties) {
          const propId = prop.id;
          if (state.seen[`otm-${propId}`]) { process.stdout.write("s"); continue; }

          try {
            await sleep(DELAY_MS);

            // Upload images
            const images = (prop.images || []).slice(0, MAX_IMAGES);
            const r2Urls = [];
            const imgSlug = slugify(location.label);
            for (const img of images) {
              const imgUrl = img.default || img.webp;
              if (!imgUrl) continue;
              const r2Url = await uploadToR2(imgUrl, imgSlug);
              if (r2Url) { r2Urls.push(r2Url); state.stats.images++; }
            }

            const res = await insertProperty(prop, location.label, r2Urls);
            if (res.skipped) { state.stats.skipped++; process.stdout.write("d"); }
            else { state.stats.properties++; process.stdout.write("."); }

            state.seen[`otm-${propId}`] = true;
            if (state.stats.properties % 5 === 0) saveState(state);
          } catch (e) {
            console.error(`\n  Err ${propId}: ${e.message}`);
            process.stdout.write("x");
          }
        }

        const min = ((Date.now() - t0) / 60000).toFixed(1);
        console.log(`\n  [${min}m] P:${state.stats.properties} I:${state.stats.images} S:${state.stats.skipped}`);
        saveState(state);
      }
    }
  }

  saveState(state);
  const totalMin = ((Date.now() - t0) / 60000).toFixed(1);
  console.log(`\n  DONE in ${totalMin}m | Props: ${state.stats.properties} | Images: ${state.stats.images}\n`);
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
