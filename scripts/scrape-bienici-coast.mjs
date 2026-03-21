#!/usr/bin/env node
// ============================================================
// Bienici.com Scraper — French Coast (53 cities)
// Uses targeted zone API with access_token
// Usage: node scripts/scrape-bienici-coast.mjs [--delay 800] [--max-per-city 500]
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
const MAX_PER_CITY = Number(getArg("--max-per-city", "500"));
const PER_PAGE = 24;
const MAX_PAGES_PER_CITY = Math.ceil(MAX_PER_CITY / PER_PAGE);
const MAX_IMAGES = 6;
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";
const BASE = "https://www.bienici.com/realEstateAds.json";
const TOKEN = "IPHtg0ppwnnMfdB+tJ/3/t5jfBKBAfi0cmag4L/hyjw=:69bd829d18f67000b49bc797";
const TOKEN_ID = "69bd829d18f67000b49bc797";

// === French coastal cities ===
const ZONES = [
  // Côte d'Azur
  { name: "Nice", id: "-170100" },
  { name: "Cannes", id: "-91734" },
  { name: "Antibes", id: "-74687" },
  { name: "Menton", id: "-74727" },
  { name: "Saint-Tropez", id: "-970823" },
  { name: "Fréjus", id: "-186322" },
  { name: "Saint-Raphaël", id: "-190208" },
  { name: "Villefranche-sur-Mer", id: "-174961" },
  { name: "Beaulieu-sur-Mer", id: "-174955" },
  { name: "Cap-d'Ail", id: "-174956" },
  { name: "Èze", id: "-174959" },
  { name: "Roquebrune-Cap-Martin", id: "-174558" },
  { name: "Mougins", id: "-89292" },
  { name: "Grasse", id: "-102748" },
  { name: "Mandelieu-la-Napoule", id: "-91777" },
  { name: "Théoule-sur-Mer", id: "-74695" },
  // Var coast
  { name: "Toulon", id: "-35280" },
  { name: "Hyères", id: "-380060" },
  { name: "Bandol", id: "-1203272" },
  { name: "Sanary-sur-Mer", id: "-163056" },
  { name: "Six-Fours-les-Plages", id: "-194637" },
  { name: "La Seyne-sur-Mer", id: "-29188" },
  { name: "Sainte-Maxime", id: "-223565" },
  { name: "Cavalaire-sur-Mer", id: "-971022" },
  { name: "Le Lavandou", id: "-970872" },
  // Provence
  { name: "Marseille", id: "-76469" },
  { name: "Cassis", id: "-76425" },
  { name: "La Ciotat", id: "-67741" },
  { name: "Aix-en-Provence", id: "-70279" },
  // Languedoc
  { name: "Montpellier", id: "-28722" },
  { name: "Sète", id: "-255450" },
  { name: "Agde", id: "-254843" },
  { name: "Narbonne", id: "-54737" },
  { name: "Perpignan", id: "-18000" },
  { name: "Collioure", id: "-18409" },
  { name: "Banyuls-sur-Mer", id: "-18391" },
  // Atlantic / Basque
  { name: "Biarritz", id: "-166717" },
  { name: "Bayonne", id: "-166713" },
  { name: "Saint-Jean-de-Luz", id: "-166727" },
  { name: "Arcachon", id: "-109382" },
  { name: "La Rochelle", id: "-117858" },
  { name: "Les Sables-d'Olonne", id: "-156591" },
  // Brittany
  { name: "Saint-Malo", id: "-905534" },
  { name: "Dinard", id: "-177066" },
  // Normandy
  { name: "Deauville", id: "-135589" },
  { name: "Honfleur", id: "-126415" },
  { name: "Étretat", id: "-2673357" },
  { name: "Dieppe", id: "-110435" },
  // Corsica — all
  { name: "Ajaccio", id: "-73283" },
  { name: "Bastia", id: "-73444" },
  { name: "Porto-Vecchio", id: "-89326" },
  { name: "Bonifacio", id: "-122377" },
  { name: "Calvi", id: "-1151255" },
  { name: "Propriano", id: "-73343" },
  { name: "Sartène", id: "-1112243" },
  { name: "Corte", id: "-1772249" },
  { name: "L'Île-Rousse", id: "-1928202" },
  { name: "Saint-Florent", id: "-1133644" },
  { name: "Ghisonaccia", id: "-76886" },
  { name: "Aléria", id: "-76760" },
  { name: "Sari-Solenzara", id: "-77318" },
  { name: "Figari", id: "-122378" },
  { name: "Cargèse", id: "-1110906" },
  { name: "Piana", id: "-1112167" },
  { name: "Serra-di-Ferro", id: "-73196" },
  { name: "Olmeto", id: "-73339" },
  { name: "Zonza", id: "-85496" },
  { name: "Lecci", id: "-85886" },
  { name: "Lumio", id: "-1132307" },
  { name: "Algajola", id: "-1115363" },
  { name: "Belgodère", id: "-74160" },
  { name: "Patrimonio", id: "-3226798" },
  { name: "Grosseto-Prugna", id: "-73286" },
  { name: "Pietrosella", id: "-73260" },
  { name: "Coti-Chiavari", id: "-73218" },
  { name: "Vico", id: "-1110949" },
  { name: "Ota", id: "-1110926" },
  { name: "Galéria", id: "-1127838" },
  { name: "Bastelicaccia", id: "-73267" },
  { name: "Peri", id: "-150120" },
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
const STATE_FILE = resolve(ROOT, "scripts/.scrape-bienici-coast-state.json");
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

// ===== Insert Property =====
async function insertProperty(ad, r2Images) {
  const id = ad.id;
  const title = ad.title || `${ad.propertyType === "flat" ? "Appartement" : "Maison"} ${ad.roomsQuantity || ""}p - ${ad.city}`;
  const city = ad.city || "France";
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
    country: "fr",
    featured: false, active: true,
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
  console.log(`\n  Bienici FRENCH COAST Scraper — ${ZONES.length} cities | Delay: ${DELAY_MS}ms\n`);
  const state = loadState();
  const t0 = Date.now();
  let newProps = 0, newImages = 0, skipped = 0;

  for (const zone of ZONES) {
    // Skip already completed zones (for resumability)
    const zoneKey = `${zone.id}-buy`;
    if (state.completedZones?.includes(zoneKey)) {
      console.log(`\n  [skip] ${zone.name} — already completed`);
      continue;
    }

    for (const type of ["buy"]) {
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
            const imgSlug = slugify(ad.city || "france");
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
    }

    // Mark zone as completed
    if (!state.completedZones) state.completedZones = [];
    state.completedZones.push(zoneKey);
    saveState(state);
  }

  saveState(state);
  const totalMin = ((Date.now() - t0) / 60000).toFixed(1);
  console.log(`\n  DONE in ${totalMin}m | New props: ${newProps} | New images: ${newImages} | Skipped: ${skipped}\n`);
}
main().catch(e => { console.error("Fatal:", e); process.exit(1); });
