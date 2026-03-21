#!/usr/bin/env node
// Chamonix-targeted scraper using bienici.com zone API
// Reuses existing scraper infrastructure from scrape-bienici-alpy.mjs

import { createClient } from "@supabase/supabase-js";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { readFileSync, existsSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = process.cwd();

const DELAY_MS = 800;
const PER_PAGE = 24;
const MAX_IMAGES = 6;
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";
const BASE = "https://www.bienici.com/realEstateAds.json";
const TOKEN = "IPHtg0ppwnnMfdB+tJ/3/t5jfBKBAfi0cmag4L/hyjw=:69bd829d18f67000b49bc797";
const TOKEN_ID = "69bd829d18f67000b49bc797";
const ZONES = [
  { name: "Chamonix-Mont-Blanc", id: "-104836" },
  { name: "Les Houches", id: "-104826" },
  { name: "Servoz", id: "-104822" },
  { name: "Vallorcine", id: "-104843" },
  { name: "Les Contamines-Montjoie", id: "-104726" },
  { name: "Saint-Gervais-les-Bains", id: "-104744" },
  { name: "Megève", id: "-75312" },
  { name: "Combloux", id: "-75315" },
  { name: "Passy", id: "-75343" },
  { name: "Sallanches", id: "-75324" },
];

// Load env
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

// State (reuse alpy state so we don't re-import already-seen ads)
const STATE_FILE = resolve(ROOT, "scripts/.scrape-bienici-alpy-state.json");
function loadState() {
  try { return JSON.parse(readFileSync(STATE_FILE, "utf8")); }
  catch { return { seen: {}, stats: { properties: 0, images: 0, skipped: 0, filtered: 0 } }; }
}
function saveState(state) { writeFileSync(STATE_FILE, JSON.stringify(state, null, 2)); }

function slugify(t) {
  return t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
}
async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function mapPropertyType(t) {
  const map = { flat: "apartment", house: "house", loft: "apartment", castle: "house", parking: "other", programme: "apartment", townhouse: "house", land: "land" };
  return map[t] || "other";
}
function mapAdType(t) { return t === "rent" ? "rent" : "sale"; }

async function uploadToR2(imageUrl, slug) {
  if (!r2) return null;
  try {
    const resp = await fetch(imageUrl, {
      headers: { "User-Agent": UA, "Referer": "https://www.bienici.com/" },
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

const geoCache = new Map();
async function geocodeCity(city, postalCode) {
  const key = `${city}-${postalCode || ""}`;
  if (geoCache.has(key)) return geoCache.get(key);
  try {
    const q = encodeURIComponent(`${city} ${postalCode || ""} France`);
    const resp = await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`, {
      headers: { "User-Agent": "Nemovizor/1.0 (educational)" }, signal: AbortSignal.timeout(5000),
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

async function insertProperty(ad, r2Images) {
  const id = ad.id;
  const title = ad.title || `${ad.propertyType === "flat" ? "Appartement" : "Maison"} ${ad.roomsQuantity || ""}p - ${ad.city}`;
  const city = ad.city || "Chamonix-Mont-Blanc";
  const district = ad.district?.name || ad.displayDistrictName || city;
  const rawPrice = ad.price;
  const price = Array.isArray(rawPrice) ? rawPrice[0] : (typeof rawPrice === "number" ? rawPrice : parseFloat(rawPrice) || 0);
  if (price < 1000 && mapAdType(ad.adType) === "sale") return { skipped: true };
  if (price > 120000000) return { skipped: true };

  const slug = slugify(title + "-" + city + "-bn" + id.replace(/[^a-z0-9]/gi, "").slice(-8));
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
    slug, title, listing_type: mapAdType(ad.adType), category: mapPropertyType(ad.propertyType),
    subtype: ad.propertyType === "flat" ? "atypicky" : "rodinny",
    rooms_label: ad.roomsQuantity ? `${ad.roomsQuantity} pieces` : undefined,
    price, price_currency: "eur",
    price_unit: mapAdType(ad.adType) === "rent" ? "za_mesic" : undefined,
    city, district,
    location_label: `${district}, ${city} ${ad.postalCode || ""}`.trim(),
    latitude: lat, longitude: lng,
    area: typeof area === "number" ? area : parseFloat(area) || 0,
    summary: (desc.slice(0, 300).replace(/\n/g, " ").trim()) || title,
    description: desc || undefined,
    elevator: ad.hasElevator || false, cellar: ad.hasCellar || false,
    terrace: ad.hasTerrace || false, pool: ad.hasPool || false,
    balcony: ad.hasBalcony || false, garden: ad.hasGarden || false,
    garage: ad.hasParking || false,
    image_src: r2Images[0], image_alt: title, images: r2Images,
    featured: false, active: true,
  };

  const { error } = await sb.from("properties").insert(property);
  if (error) {
    if (error.code === "23505") return { skipped: true };
    throw new Error(error.message);
  }
  return { skipped: false };
}

async function fetchPage(type, page, zoneId) {
  const filters = {
    size: PER_PAGE, from: page * PER_PAGE,
    filterType: type, propertyType: ["house", "flat", "loft", "castle", "townhouse"],
    page: page + 1, sortBy: "relevance", sortOrder: "desc",
    onTheMarket: [true],
    zoneIdsByTypes: { zoneIds: [zoneId] },
  };
  const url = `${BASE}?filters=${encodeURIComponent(JSON.stringify(filters))}&extensionType=extendedIfNoResult&access_token=${encodeURIComponent(TOKEN)}&id=${TOKEN_ID}`;
  const resp = await fetch(url, { headers: { "User-Agent": UA, "Referer": "https://www.bienici.com/" }, signal: AbortSignal.timeout(15000) });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const data = await resp.json();
  return { total: data.total || 0, ads: data.realEstateAds || [] };
}

async function main() {
  console.log("\n  Bienici CHAMONIX AREA Scraper — targeted zone API\n");
  const state = loadState();
  const t0 = Date.now();
  let newProps = 0, newImages = 0, skipped = 0;

  for (const zone of ZONES) {
    for (const type of ["buy", "rent"]) {
      console.log(`\n== ${zone.name} — ${type === "buy" ? "Achat" : "Location"} ==`);
      let page = 0;
      while (true) {
        let result;
        try { result = await fetchPage(type, page, zone.id); }
        catch (e) { console.error(`  Fetch error p${page}: ${e.message}`); break; }

        if (!result.ads.length) { console.log(`  No more results (total: ${result.total})`); break; }
        console.log(`\n  Page ${page + 1} — ${result.ads.length} ads (total: ${result.total})`);

        for (const ad of result.ads) {
          if (state.seen[`bn-${ad.id}`]) { process.stdout.write("s"); skipped++; continue; }
          try {
            await sleep(DELAY_MS);
            const photos = (ad.photos || []).slice(0, MAX_IMAGES);
            const r2Urls = [];
            const imgSlug = slugify(ad.city || "chamonix");
            for (const photo of photos) {
              const urls = [photo.url, photo.url_photo].filter(Boolean);
              let r2Url = null;
              for (const u of urls) { r2Url = await uploadToR2(u, imgSlug); if (r2Url) break; }
              if (r2Url) { r2Urls.push(r2Url); newImages++; state.stats.images++; }
            }
            const res = await insertProperty(ad, r2Urls);
            if (res.skipped) { state.stats.skipped++; process.stdout.write("d"); }
            else { newProps++; state.stats.properties++; process.stdout.write("."); }
            state.seen[`bn-${ad.id}`] = true;
            if (newProps % 3 === 0) saveState(state);
          } catch (e) {
            console.error(`\n  Err ${ad.id}: ${e.message}`);
            process.stdout.write("x");
          }
        }
        const min = ((Date.now() - t0) / 60000).toFixed(1);
        console.log(`  [${min}m] new:${newProps} img:${newImages} skip:${skipped}`);
        saveState(state);
        page++;
        if (result.ads.length < PER_PAGE) break;
      }
    }
  }
  saveState(state);
  const totalMin = ((Date.now() - t0) / 60000).toFixed(1);
  console.log(`\n  DONE in ${totalMin}m | New props: ${newProps} | New images: ${newImages} | Skipped: ${skipped}\n`);
}
main().catch(e => { console.error("Fatal:", e); process.exit(1); });
