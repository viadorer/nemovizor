#!/usr/bin/env node
// ============================================================
// Nehnutelnosti.sk Scraper (Slovakia)
// Properties + R2 images -> Supabase
// Usage: node scripts/scrape-nehnutelnosti.mjs [--pages 20] [--delay 2000]
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
const MAX_IMAGES = 6;
const PER_PAGE = 30;
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";

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
if (!r2) console.warn("WARNING: R2 not configured -- images skipped");

// ===== State =====
const STATE_FILE = resolve(ROOT, "scripts/.scrape-nehnutelnosti-state.json");
function loadState() {
  try { return JSON.parse(readFileSync(STATE_FILE, "utf8")); }
  catch { return { seen: {}, stats: { properties: 0, images: 0, skipped: 0, agencies: 0 } }; }
}
function saveState(state) { writeFileSync(STATE_FILE, JSON.stringify(state, null, 2)); }

// ===== Helpers =====
function slugify(t) {
  return t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
}
async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ===== Map category from nehnutelnosti.sk to our schema =====
function mapCategory(cat) {
  if (!cat) return "other";
  const c = cat.toLowerCase();
  if (c.includes("byt") || c.includes("izbov") || c.includes("garson")) return "apartment";
  if (c.includes("dom") || c.includes("chata") || c.includes("chalup") || c.includes("farm")) return "house";
  if (c.includes("pozem") || c.includes("zahrad")) return "land";
  if (c.includes("kancel") || c.includes("obchod") || c.includes("sklad") || c.includes("hotel") || c.includes("restaur")) return "commercial";
  return "other";
}

// ===== Map listing type =====
function mapListingType(url) {
  if (url && url.includes("prenajom")) return "rent";
  return "sale";
}

// ===== Extract rooms from category string =====
function extractRooms(cat, numberOfRooms) {
  if (numberOfRooms) return `${numberOfRooms} izby`;
  if (!cat) return undefined;
  const m = cat.match(/(\d+)\s*izb/i);
  if (m) return `${m[1]} izby`;
  if (/garson/i.test(cat)) return "1 izba";
  return undefined;
}

// ===== Extract city from title/description =====
function extractCity(title) {
  // Title format: "Predaj byty 2 iz. NOVOSTAVBA Rybnicna ul. Vajnory - Bratislava III"
  // City is usually the last part after dash
  const parts = title.split(/\s*-\s*/);
  if (parts.length > 1) {
    // Last part is typically city or district
    return parts[parts.length - 1].trim();
  }
  // Fallback: try to find known Slovak cities
  const cities = ["Bratislava", "Kosice", "Presov", "Zilina", "Nitra", "Banska Bystrica", "Trnava", "Trencin", "Martin", "Poprad", "Prievidza", "Zvolen", "Piestany", "Komarno", "Michalovce", "Levice", "Spisska Nova Ves", "Lucenec", "Humenne", "Nove Zamky"];
  for (const city of cities) {
    if (title.includes(city)) return city;
  }
  return "Slovensko";
}

// ===== Geocoding =====
const geoCache = new Map();
async function geocodeCity(city) {
  const key = city.toLowerCase().trim();
  if (geoCache.has(key)) return geoCache.get(key);
  try {
    const q = encodeURIComponent(`${city}, Slovakia`);
    const resp = await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&countrycodes=sk`, {
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

// ===== R2 Upload =====
async function uploadToR2(imageUrl, slug) {
  if (!r2) return null;
  try {
    const resp = await fetch(imageUrl, {
      headers: { "User-Agent": UA, "Referer": "https://www.nehnutelnosti.sk/" },
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

// ===== Extract JSON-LD from Next.js RSC page =====
function extractJsonLd(html) {
  const listings = [];
  const agents = new Map();

  // Next.js RSC embeds JSON-LD as JS-escaped strings in self.__next_f.push() calls.
  const pushes = html.match(/self\.__next_f\.push\(\[.*?\]\)/gs) || [];
  for (const push of pushes) {
    if (push.indexOf("ItemList") === -1 || push.indexOf("itemListElement") === -1) continue;

    const strMatch = push.match(/self\.__next_f\.push\(\[\d+,"(.*)"\]\)$/s);
    if (!strMatch) continue;

    // Unescape the JS string content
    let decoded;
    try {
      decoded = JSON.parse('"' + strMatch[1] + '"');
    } catch {
      decoded = strMatch[1]
        .replace(/\\\\/g, '\x00BS\x00')
        .replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\"/g, '"')
        .replace(/\x00BS\x00/g, '\\');
    }

    // Find JSON-LD object
    const ctxIdx = decoded.indexOf('"@context"');
    if (ctxIdx === -1) continue;
    let startIdx = 0;
    for (let i = ctxIdx - 1; i >= 0; i--) {
      if (decoded[i] === '{') { startIdx = i; break; }
    }

    try {
      const obj = JSON.parse(decoded.slice(startIdx));
      processJsonLd(obj, listings, agents);
    } catch {}
  }

  return { listings, agents };
}

function processJsonLd(obj, listings, agents) {
  if (!obj) return;

  // Handle @graph arrays
  if (obj["@graph"]) {
    for (const item of obj["@graph"]) {
      processJsonLd(item, listings, agents);
    }
    return;
  }

  // RealEstateAgent
  if (obj["@type"] === "RealEstateAgent") {
    agents.set(obj["@id"], obj);
    return;
  }

  // SearchResultsPage with ItemList
  if (obj["@type"] === "SearchResultsPage" && obj.mainEntity?.itemListElement) {
    for (const li of obj.mainEntity.itemListElement) {
      if (li.item) listings.push(li.item);
    }
    return;
  }

  // Direct ItemList
  if (obj["@type"] === "ItemList" && obj.itemListElement) {
    for (const li of obj.itemListElement) {
      if (li.item) listings.push(li.item);
    }
    return;
  }

  // Look for nested arrays that might contain schema objects
  if (Array.isArray(obj)) {
    for (const item of obj) {
      processJsonLd(item, listings, agents);
    }
  }
}

// ===== Insert Property =====
async function insertProperty(item, r2Images, listingType) {
  const title = item.name || "Nehnutelnost";
  const city = extractCity(title);
  const price = item.priceSpecification?.price || (item.offers?.price ? parseFloat(item.offers.price) : 0);
  const currency = (item.priceSpecification?.priceCurrency || item.offers?.priceCurrency || "EUR").toLowerCase();

  if (price < 500 && listingType === "sale") return { skipped: true };
  if (price > 120000000) return { skipped: true };

  const itemId = (item["@id"] || item.url || "").replace(/.*\//, "").replace(/[^a-zA-Z0-9]/g, "").slice(-12);
  const slug = slugify(title + "-nh" + itemId);

  // Dedup
  const { data: dup } = await sb.from("properties").select("id").eq("title", title).eq("city", city).maybeSingle();
  if (dup) return { skipped: true };
  const { data: dup2 } = await sb.from("properties").select("id").eq("slug", slug).maybeSingle();
  if (dup2) return { skipped: true };

  const desc = (item.description || "").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").trim();
  const area = item.floorSize?.value || 0;
  const rooms = extractRooms(item.category, item.numberOfRooms);
  const category = mapCategory(item.category);

  // Geocode
  const geo = await geocodeCity(city);
  if (!geo) return { skipped: true };

  if (!r2Images.length) return { skipped: true };

  const property = {
    slug,
    title,
    listing_type: listingType,
    category,
    subtype: category === "apartment" ? "atypicky" : category === "house" ? "rodinny" : undefined,
    rooms_label: rooms,
    price,
    price_currency: currency,
    price_unit: listingType === "rent" ? "za_mesic" : undefined,
    city,
    district: city,
    location_label: city,
    latitude: geo.lat,
    longitude: geo.lon,
    area: typeof area === "number" ? area : parseFloat(area) || 0,
    summary: (desc.slice(0, 300).replace(/\n/g, " ").trim()) || title,
    description: desc || undefined,
    image_src: r2Images[0],
    image_alt: title,
    images: r2Images,
    featured: false,
    active: true,
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
  Nehnutelnosti.sk Scraper | Pages: ${PAGES} | Delay: ${DELAY_MS}ms | Max imgs: ${MAX_IMAGES}
  Target: Slovakia
`);

  const state = loadState();
  const t0 = Date.now();

  // Search configs - all categories
  const searches = [
    { path: "byty/predaj", label: "Byty - predaj" },
    { path: "byty/prenajom", label: "Byty - prenajom" },
    { path: "domy/predaj", label: "Domy - predaj" },
    { path: "domy/prenajom", label: "Domy - prenajom" },
    { path: "pozemky/predaj", label: "Pozemky - predaj" },
    { path: "priestory/predaj", label: "Komercni - predaj" },
    { path: "priestory/prenajom", label: "Komercni - prenajom" },
  ];

  for (const search of searches) {
    const urlPath = search.path;
    const listingType = urlPath.includes("prenajom") ? "rent" : "sale";
    console.log(`\n== ${search.label} ==`);

      for (let page = 1; page <= PAGES; page++) {
        const url = `https://www.nehnutelnosti.sk/vysledky/${urlPath}/?p=${page}`;
        console.log(`\n  Page ${page}/${PAGES} - ${url}`);

        let html;
        try {
          const resp = await fetch(url, {
            headers: {
              "User-Agent": UA,
              "Accept": "text/html,application/xhtml+xml",
              "Accept-Language": "sk,cs;q=0.9,en;q=0.8",
            },
            redirect: "follow",
            signal: AbortSignal.timeout(15000),
          });
          if (!resp.ok) {
            console.error(`  HTTP ${resp.status}`);
            if (resp.status === 404 || resp.status === 308) break;
            await sleep(3000);
            continue;
          }
          html = await resp.text();
        } catch (e) {
          console.error(`  Fetch error: ${e.message}`);
          await sleep(3000);
          continue;
        }

        const { listings } = extractJsonLd(html);
        if (!listings.length) {
          console.log("  No listings found, moving to next search");
          break;
        }
        console.log(`  Found ${listings.length} listings`);

        for (const item of listings) {
          const itemId = (item["@id"] || item.url || "").replace(/.*\//, "").replace(/[^a-zA-Z0-9]/g, "");
          if (state.seen[`nh-${itemId}`]) { process.stdout.write("s"); continue; }

          try {
            await sleep(DELAY_MS);

            // Pre-check dedup
            const preTitle = item.name || "Nehnutelnost";
            const preCity = extractCity(preTitle);
            const { data: preDup } = await sb.from("properties").select("id").eq("title", preTitle).eq("city", preCity).maybeSingle();
            if (preDup) { state.stats.skipped++; state.seen[`nh-${itemId}`] = true; process.stdout.write("d"); continue; }

            // Upload images
            const photos = (Array.isArray(item.image) ? item.image : item.image ? [item.image] : []).slice(0, MAX_IMAGES);
            const r2Urls = [];
            const imgSlug = slugify(preCity || "sk");
            for (const photoUrl of photos) {
              if (!photoUrl || typeof photoUrl !== "string") continue;
              const r2Url = await uploadToR2(photoUrl, imgSlug);
              if (r2Url) { r2Urls.push(r2Url); state.stats.images++; }
            }

            const res = await insertProperty(item, r2Urls, listingType);
            if (res.skipped) { state.stats.skipped++; process.stdout.write("d"); }
            else { state.stats.properties++; process.stdout.write("."); }

            state.seen[`nh-${itemId}`] = true;
            if (state.stats.properties % 5 === 0) saveState(state);
          } catch (e) {
            console.error(`\n  Err ${itemId}: ${e.message}`);
            process.stdout.write("x");
          }
        }

        const min = ((Date.now() - t0) / 60000).toFixed(1);
        console.log(`\n  [${min}m] P:${state.stats.properties} I:${state.stats.images} S:${state.stats.skipped}`);
        saveState(state);
      }
  }

  saveState(state);
  const totalMin = ((Date.now() - t0) / 60000).toFixed(1);
  console.log(`\n  DONE in ${totalMin}m | Props: ${state.stats.properties} | Images: ${state.stats.images}\n`);
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
