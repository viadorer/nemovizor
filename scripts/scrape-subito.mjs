#!/usr/bin/env node
// ============================================================
// Subito.it Scraper — Italian Real Estate
// Plain fetch with __NEXT_DATA__ JSON extraction
// Usage: node scripts/scrape-subito.mjs [--pages 20] [--delay 2000] [--max-per-city 500]
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
const MAX_PER_CITY = Number(getArg("--max-per-city", "500"));
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
const STATE_FILE = resolve(ROOT, "scripts/.scrape-state-subito.json");
function loadState() {
  try { return JSON.parse(readFileSync(STATE_FILE, "utf8")); }
  catch { return { seen: {}, stats: { properties: 0, images: 0, skipped: 0, errors: 0 }, completedSearches: [] }; }
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
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "it-IT,it;q=0.9,en;q=0.5",
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
    if (buf.byteLength < 500) return null;
    const key = `properties/${slug}/${Date.now()}-${Math.random().toString(36).slice(2, 6)}.jpg`;
    await r2.send(new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: buf,
      ContentType: resp.headers.get("content-type") || "image/jpeg",
      CacheControl: "public, max-age=31536000, immutable",
    }));
    return `${R2_PUBLIC_URL}/${key}`;
  } catch { return null; }
}

// ===== Geocode =====
const geoCache = new Map();
async function geocodeCity(city) {
  if (geoCache.has(city)) return geoCache.get(city);
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city + ", Italy")}&format=json&limit=1`;
    const res = await fetch(url, { headers: { "User-Agent": "Nemovizor/1.0 (educational)" }, signal: AbortSignal.timeout(5000) });
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
    const items = data?.props?.pageProps?.initialState?.items?.list ?? [];
    return items;
  } catch (e) {
    console.error("  Failed to parse __NEXT_DATA__:", e.message);
    return [];
  }
}

// ===== Extract feature value from features dict =====
function getFeature(features, uri) {
  if (!features || typeof features !== "object") return null;
  const feat = features[uri];
  if (!feat || !feat.values || !feat.values.length) return null;
  return feat.values[0].value ?? feat.values[0].key ?? null;
}

function getFeatureNum(features, uri) {
  const val = getFeature(features, uri);
  if (val === null || val === undefined) return 0;
  const num = parseFloat(String(val).replace(/[^\d.,]/g, "").replace(",", "."));
  return isNaN(num) ? 0 : num;
}

// ===== Search configs =====
// URL pattern: https://www.subito.it/annunci-{region}/vendita/appartamenti/{province}/?o={page}
// For rent: replace vendita with affitto
// For houses: replace appartamenti with ville-singole-e-a-schiera

const CITIES = [
  // Top 5 cities — sale apartments, sale houses, rent apartments
  { name: "Roma", region: "lazio", province: "roma", top5: true },
  { name: "Milano", region: "lombardia", province: "milano", top5: true },
  { name: "Firenze", region: "toscana", province: "firenze", top5: true },
  { name: "Napoli", region: "campania", province: "napoli", top5: true },
  { name: "Torino", region: "piemonte", province: "torino", top5: true },
  // Other major cities — sale apartments, sale houses
  { name: "Bologna", region: "emilia-romagna", province: "bologna" },
  { name: "Venezia", region: "veneto", province: "venezia" },
  { name: "Genova", region: "liguria", province: "genova" },
  { name: "Palermo", region: "sicilia", province: "palermo" },
  { name: "Catania", region: "sicilia", province: "catania" },
  { name: "Bari", region: "puglia", province: "bari" },
  { name: "Cagliari", region: "sardegna", province: "cagliari" },
  { name: "Verona", region: "veneto", province: "verona" },
  { name: "Padova", region: "veneto", province: "padova" },
  { name: "Trieste", region: "friuli-venezia-giulia", province: "trieste" },
  { name: "Perugia", region: "umbria", province: "perugia" },
  { name: "Como", region: "lombardia", province: "como" },
  { name: "Bergamo", region: "lombardia", province: "bergamo" },
  { name: "Brescia", region: "lombardia", province: "brescia" },
  { name: "Rimini", region: "emilia-romagna", province: "rimini" },
  { name: "Lecce", region: "puglia", province: "lecce" },
  { name: "Siena", region: "toscana", province: "siena" },
  { name: "Lucca", region: "toscana", province: "lucca" },
  { name: "Pisa", region: "toscana", province: "pisa" },
  // Coastal / tourist areas
  { name: "Salerno (Amalfi)", region: "campania", province: "salerno" },
  { name: "La Spezia (Cinque Terre)", region: "liguria", province: "la-spezia" },
  { name: "Sassari", region: "sardegna", province: "sassari" },
  { name: "Olbia-Tempio", region: "sardegna", province: "olbia-tempio" },
  { name: "Messina", region: "sicilia", province: "messina" },
  { name: "Siracusa", region: "sicilia", province: "siracusa" },
  { name: "Trapani", region: "sicilia", province: "trapani" },
  { name: "Brindisi", region: "puglia", province: "brindisi" },
  { name: "Taranto", region: "puglia", province: "taranto" },
  { name: "Savona", region: "liguria", province: "savona" },
  { name: "Imperia", region: "liguria", province: "imperia" },
];

// Build search list: for each city, sale apartments + sale houses; top 5 also get rent apartments
function buildSearches() {
  const searches = [];
  for (const city of CITIES) {
    searches.push({
      label: `${city.name} — Appartamenti Vendita`,
      url: `https://www.subito.it/annunci-${city.region}/vendita/appartamenti/${city.province}/`,
      listingType: "sale",
      category: "apartment",
      cityName: city.name,
      province: city.province,
    });
    searches.push({
      label: `${city.name} — Ville Vendita`,
      url: `https://www.subito.it/annunci-${city.region}/vendita/ville-singole-e-a-schiera/${city.province}/`,
      listingType: "sale",
      category: "house",
      cityName: city.name,
      province: city.province,
    });
    if (city.top5) {
      searches.push({
        label: `${city.name} — Appartamenti Affitto`,
        url: `https://www.subito.it/annunci-${city.region}/affitto/appartamenti/${city.province}/`,
        listingType: "rent",
        category: "apartment",
        cityName: city.name,
        province: city.province,
      });
    }
  }
  return searches;
}

// ===== Main =====
async function main() {
  const t0 = Date.now();
  const state = loadState();
  if (!state.completedSearches) state.completedSearches = [];
  let totalProps = 0, totalImages = 0, totalSkipped = 0, totalErrors = 0;

  const searches = buildSearches();
  console.log(`\n  Subito.it Scraper | ${searches.length} searches | Pages: ${PAGES} | Delay: ${DELAY_MS}ms | Max/city: ${MAX_PER_CITY}\n`);

  for (const search of searches) {
    // Resumability: skip completed searches
    const searchKey = `${search.province}-${search.listingType}-${search.category}`;
    if (state.completedSearches.includes(searchKey)) {
      console.log(`\n  [skip] ${search.label} — already completed`);
      continue;
    }

    console.log(`\n== ${search.label} ==`);
    let cityInserted = 0;

    for (let page = 1; page <= PAGES; page++) {
      if (cityInserted >= MAX_PER_CITY) {
        console.log(`  Max per city reached (${MAX_PER_CITY}), moving on`);
        break;
      }

      try {
        const url = page === 1 ? search.url : `${search.url}?o=${page}`;
        const html = await fetchPage(url);
        const listings = extractListings(html);

        if (!listings.length) {
          console.log(`  Page ${page}: empty, stopping search`);
          break;
        }

        let inserted = 0, skipped = 0;
        for (const raw of listings) {
          if (cityInserted >= MAX_PER_CITY) break;

          // Items are wrapped: { before, item, after, kind }
          const item = raw.item || raw;
          if (!item || item.kind !== "AdItem") continue;

          // Extract listing ID
          const listId = String(item.urn || item.id || "");
          if (!listId) continue;

          const stateKey = `sub-${listId}`;
          if (state.seen[stateKey]) { skipped++; totalSkipped++; continue; }

          try {
            const title = item.subject || "";
            const body = item.body || "";

            // Extract features (dict with URI keys like "/price", "/size")
            const features = item.features || {};
            const price = getFeatureNum(features, "/price") || 0;
            const area = getFeatureNum(features, "/size") || 0;
            const rooms = getFeatureNum(features, "/room") || 0;
            const bathrooms = getFeatureNum(features, "/bathrooms") || 0;
            const floor = getFeature(features, "/floor") || "";
            const elevator = getFeature(features, "/elevator") || "";
            const parking = getFeature(features, "/parking") || "";
            const garden = getFeature(features, "/garden") || "";
            const buildingCondition = getFeature(features, "/building_condition") || "";

            // Location — geo fields are objects with .value, extract string values
            const geo = item.geo || {};
            const city = (typeof geo.city === "object" ? geo.city?.value : geo.city) || search.cityName;
            const town = (typeof geo.town === "object" ? geo.town?.value : geo.town) || "";
            const region = (typeof geo.region === "object" ? geo.region?.value : geo.region) || "";

            const slug = slugify(title || `immobile-${listId}`) + `-sub${String(listId).replace(/[^a-z0-9]/gi, "").slice(-8)}`;

            // Check for duplicate by slug
            const { data: dup } = await sb.from("properties").select("id").eq("slug", slug).maybeSingle();
            if (dup) { state.seen[stateKey] = true; skipped++; totalSkipped++; continue; }

            // Geocode using Nominatim
            let lat = 0, lon = 0;
            const geoQuery = town || city || search.cityName;
            if (geoQuery) {
              const geoResult = await geocodeCity(geoQuery);
              if (geoResult) { lat = geoResult.lat; lon = geoResult.lon; }
            }

            // Upload images to R2
            const rawImages = (item.images || []).slice(0, MAX_IMAGES);
            const r2Images = [];
            for (const img of rawImages) {
              // img is { cdnBaseUrl: "https://images.sbito.it/api/v1/..." }
              const baseUrl = typeof img === "string" ? img : (img.cdnBaseUrl || img.uri || img.url || "");
              // Use query parameter format: ?rule=fullscreen-1x-auto
              const imgUrl = baseUrl ? `${baseUrl}?rule=fullscreen-1x-auto` : "";
              if (!imgUrl) continue;
              const r2Url = await uploadToR2(imgUrl, slug);
              if (r2Url) { r2Images.push(r2Url); totalImages++; }
            }

            // Detail URL
            const detailUrl = item.urls?.default || "";

            // Build rooms label
            let roomsLabel = "";
            if (rooms) roomsLabel = `${rooms} locali`;
            if (bathrooms) roomsLabel += roomsLabel ? `, ${bathrooms} bagni` : `${bathrooms} bagni`;

            // Location label
            const locationParts = [town, city, region].filter(Boolean);
            const locationLabel = [...new Set(locationParts)].join(", ");

            // Summary from body or title
            const summary = (body || title || "").slice(0, 300).replace(/\n/g, " ").trim();

            // Build description with features
            let description = body || "";
            const extraInfo = [];
            if (floor) extraInfo.push(`Piano: ${floor}`);
            if (elevator) extraInfo.push(`Ascensore: ${elevator}`);
            if (parking) extraInfo.push(`Parcheggio: ${parking}`);
            if (garden) extraInfo.push(`Giardino: ${garden}`);
            if (buildingCondition) extraInfo.push(`Stato: ${buildingCondition}`);
            if (extraInfo.length) {
              description = description ? description + "\n\n" + extraInfo.join(" | ") : extraInfo.join(" | ");
            }

            const property = {
              slug,
              title: title || `Immobile a ${city || "Italia"}`,
              listing_type: search.listingType,
              category: search.category,
              subtype: search.category === "apartment" ? "atypicky" : "rodinny",
              rooms_label: roomsLabel || undefined,
              price,
              price_currency: "eur",
              price_unit: search.listingType === "rent" ? "za_mesic" : undefined,
              city: city || search.cityName,
              district: town || city || "",
              zip: "",
              region,
              location_label: locationLabel || city || search.cityName,
              latitude: lat,
              longitude: lon,
              area,
              summary: summary || title || `Immobile a ${city || "Italia"}`,
              description: description || undefined,
              elevator: elevator === "Presente" || elevator === "Si" || elevator === "Sì" || false,
              garden: !!garden && garden !== "No" && garden !== "Assente",
              garage: !!parking && parking !== "No" && parking !== "Assente",
              image_src: r2Images[0] || "/branding/placeholder.png",
              image_alt: title || `Immobile a ${city || "Italia"}`,
              images: r2Images.length ? r2Images : [],
              featured: false,
              active: true,
              source: "subito",
              country: "it",
            };

            const { error } = await sb.from("properties").insert(property);
            if (error) {
              if (error.code === "23505") { skipped++; totalSkipped++; }
              else { console.error(`  Err ${listId}: ${error.message}`); totalErrors++; }
            } else {
              inserted++;
              cityInserted++;
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
        console.log(`\n  Page ${page}: +${inserted} (${skipped} skipped) [city total: ${cityInserted}]`);

        saveState(state);
        await sleep(DELAY_MS);
      } catch (e) {
        console.error(`  Page ${page} error: ${e.message}`);
        totalErrors++;
        if (e.message.includes("HTTP 429") || e.message.includes("HTTP 403")) {
          console.log("  Rate limited, waiting 30s...");
          await sleep(30000);
        }
        break;
      }
    }

    // Mark search as completed
    state.completedSearches.push(searchKey);
    saveState(state);

    const elapsed = ((Date.now() - t0) / 60000).toFixed(1);
    console.log(`  [${elapsed}m] Total so far: ${totalProps} props, ${totalImages} imgs, ${totalSkipped} skipped`);
  }

  const elapsed = ((Date.now() - t0) / 60000).toFixed(1);
  console.log(`\n  DONE in ${elapsed}m | Properties: ${totalProps} | Images: ${totalImages} | Skipped: ${totalSkipped} | Errors: ${totalErrors}\n`);

  state.stats = { properties: totalProps, images: totalImages, skipped: totalSkipped, errors: totalErrors, lastRun: new Date().toISOString() };
  saveState(state);
}

main().catch(e => { console.error("FATAL:", e); process.exit(1); });
