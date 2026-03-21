#!/usr/bin/env node
// ============================================================
// Bienici.com Scraper — Monaco Area (FR Riviera towns bordering Monaco)
// Uses targeted zone API with access_token
// Usage: node scripts/scrape-monaco.mjs [--delay 2000] [--max-per-city 500] [--pages 20]
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

const DELAY_MS = Number(getArg("--delay", "2000"));
const MAX_PER_CITY = Number(getArg("--max-per-city", "500"));
const DEFAULT_PAGES = Number(getArg("--pages", "20"));
const PER_PAGE = 24;
const MAX_PAGES_PER_CITY = Math.min(DEFAULT_PAGES, Math.ceil(MAX_PER_CITY / PER_PAGE));
const MAX_IMAGES = 8;
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";
const BASE = "https://www.bienici.com/realEstateAds.json";
const TOKEN = "IPHtg0ppwnnMfdB+tJ/3/t5jfBKBAfi0cmag4L/hyjw=:69bd829d18f67000b49bc797";
const TOKEN_ID = "69bd829d18f67000b49bc797";
const SUGGEST_URL = "https://res.bienici.com/suggest.json";

// === Monaco-area zones (FR towns bordering Monaco) ===
// Monaco itself is not on bienici.com (French portal only).
// We scrape the surrounding FR Riviera towns that form the "Monaco area".
const ZONES = [
  { name: "Beausoleil", id: "-174562" },      // Directly borders Monaco
  { name: "Cap-d'Ail", id: "-174956" },       // West of Monaco
  { name: "Menton", id: "-74727" },            // East of Monaco
  { name: "Roquebrune-Cap-Martin", id: "" },   // Will be discovered
  { name: "La Turbie", id: "" },               // Above Monaco
  { name: "Èze", id: "" },                     // Near Monaco
  { name: "Villefranche-sur-Mer", id: "" },    // Near Monaco
  { name: "Beaulieu-sur-Mer", id: "" },        // Near Monaco
  { name: "Saint-Jean-Cap-Ferrat", id: "" },   // Near Monaco
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
const STATE_FILE = resolve(ROOT, "scripts/.scrape-state-monaco.json");
function loadState() {
  try { return JSON.parse(readFileSync(STATE_FILE, "utf8")); }
  catch { return { seen: {}, stats: { properties: 0, images: 0, skipped: 0 }, completedZones: [] }; }
}
function saveState(state) { writeFileSync(STATE_FILE, JSON.stringify(state, null, 2)); }

// ===== Helpers =====
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

// ===== Discover missing zone IDs from suggest API =====
async function resolveZoneIds() {
  console.log("  Resolving zone IDs from bienici suggest API...");
  const resolved = [];
  for (const zone of ZONES) {
    if (zone.id) {
      resolved.push(zone);
      console.log(`  ${zone.name}: ${zone.id} (hardcoded)`);
      continue;
    }
    try {
      const url = `${SUGGEST_URL}?q=${encodeURIComponent(zone.name)}`;
      const resp = await fetch(url, {
        headers: { "User-Agent": UA, "Referer": "https://www.bienici.com/" },
        signal: AbortSignal.timeout(10000),
      });
      if (!resp.ok) continue;
      const data = await resp.json();
      if (data.length && data[0].zoneIds?.length) {
        zone.id = data[0].zoneIds[0];
        resolved.push(zone);
        console.log(`  ${zone.name}: ${zone.id} (discovered)`);
      } else {
        console.log(`  ${zone.name}: not found`);
      }
      await sleep(300);
    } catch (e) {
      console.warn(`  ${zone.name}: error ${e.message}`);
    }
  }
  return resolved;
}

// ===== R2 Upload =====
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

// ===== Geocode =====
const geoCache = new Map();
async function geocodeCity(city, postalCode) {
  const key = `${city}-${postalCode || ""}`;
  if (geoCache.has(key)) return geoCache.get(key);
  try {
    const q = encodeURIComponent(`${city} ${postalCode || ""} Monaco`);
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

// ===== Insert Property =====
async function insertProperty(ad, r2Images) {
  const id = ad.id;
  const title = ad.title || `${ad.propertyType === "flat" ? "Appartement" : "Maison"} ${ad.roomsQuantity || ""}p - ${ad.city}`;
  const city = ad.city || "Monaco";
  const district = ad.district?.name || ad.displayDistrictName || city;
  const rawPrice = ad.price;
  const price = Array.isArray(rawPrice) ? rawPrice[0] : (typeof rawPrice === "number" ? rawPrice : parseFloat(rawPrice) || 0);
  if (price < 1000 && mapAdType(ad.adType) === "sale") return { skipped: true };
  if (price > 500000000) return { skipped: true }; // Monaco can have very expensive properties

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
    city, district, country: "fr",
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
    source: "bienici",
  };

  const { error } = await sb.from("properties").insert(property);
  if (error) {
    if (error.code === "23505") return { skipped: true };
    throw new Error(error.message);
  }
  return { skipped: false };
}

// ===== Fetch Page =====
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

// ===== Main =====
async function main() {
  console.log(`\n  Bienici MONACO Scraper | Delay: ${DELAY_MS}ms | Max per city: ${MAX_PER_CITY}\n`);

  // Discover zones dynamically
  console.log("  Discovering Monaco zones from bienici suggest API...");
  const ZONES = await resolveZoneIds();
  console.log(`  Using ${ZONES.length} zone(s): ${ZONES.map(z => z.name).join(", ")}\n`);

  const state = loadState();
  const t0 = Date.now();
  let newProps = 0, newImages = 0, skipped = 0;

  for (const zone of ZONES) {
    for (const type of ["buy", "rent"]) {
      const zoneKey = `${zone.id}-${type}`;
      if (state.completedZones?.includes(zoneKey)) {
        console.log(`\n  [skip] ${zone.name} (${type}) — already completed`);
        continue;
      }

      console.log(`\n== ${zone.name} — ${type === "buy" ? "Achat" : "Location"} ==`);
      let page = 0;
      while (page < MAX_PAGES_PER_CITY) {
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
            const imgSlug = slugify(ad.city || "monaco");
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
            if (newProps % 5 === 0) saveState(state);
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

      // Mark zone+type as completed
      if (!state.completedZones) state.completedZones = [];
      state.completedZones.push(zoneKey);
      saveState(state);
    }
  }

  saveState(state);
  const totalMin = ((Date.now() - t0) / 60000).toFixed(1);
  console.log(`\n  DONE in ${totalMin}m | New props: ${newProps} | New images: ${newImages} | Skipped: ${skipped}\n`);
}
main().catch(e => { console.error("Fatal:", e); process.exit(1); });
