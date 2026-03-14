#!/usr/bin/env node
// ============================================================
// Immoweb.be Scraper v2 — Playwright edition
// Belgian Real Estate — headless browser + proper price parsing
// Usage: node scripts/scrape-immoweb.mjs [--pages 5] [--delay 3000]
// ============================================================

import { createClient } from "@supabase/supabase-js";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { readFileSync, existsSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { chromium } from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// ===== Config =====
const args = process.argv.slice(2);
function getArg(name, def) {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
}

const PAGES = Number(getArg("--pages", "5"));
const DELAY_MS = Number(getArg("--delay", "3000"));
const MAX_IMAGES = 8;
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
if (!r2) console.warn("WARNING: R2 not configured — images skipped");

// ===== State =====
const STATE_FILE = resolve(ROOT, "scripts/.scrape-state-immoweb.json");
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
    const key = `uploads/images/${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${slug.slice(0, 40)}.jpg`;
    await r2.send(new PutObjectCommand({
      Bucket: R2_BUCKET_NAME, Key: key, Body: buf,
      ContentType: "image/jpeg",
      CacheControl: "public, max-age=31536000, immutable",
    }));
    return R2_PUBLIC_URL ? `${R2_PUBLIC_URL}/${key}` : key;
  } catch { return null; }
}

// ===== Category mapping =====
function mapCategory(type) {
  if (!type) return "apartment";
  const t = type.toLowerCase();
  if (t.includes("apartment") || t.includes("flat") || t.includes("studio") || t.includes("penthouse") || t.includes("loft") || t.includes("duplex") || t.includes("triplex")) return "apartment";
  if (t.includes("house") || t.includes("villa") || t.includes("bungalow") || t.includes("chalet") || t.includes("farmhouse") || t.includes("mansion") || t.includes("castle") || t.includes("town")) return "house";
  if (t.includes("land") || t.includes("ground") || t.includes("terrain")) return "land";
  if (t.includes("office") || t.includes("commercial") || t.includes("shop") || t.includes("warehouse") || t.includes("parking") || t.includes("garage")) return "commercial";
  return "other";
}

// ===== Cities =====
const CITIES = ["Brussels", "Antwerp", "Ghent", "Bruges", "Liège", "Namur", "Leuven", "Charleroi"];

// ===== Extract listings from search page =====
async function extractSearchResults(page) {
  return await page.evaluate(() => {
    const results = [];

    // Immoweb uses iw-search with __NUXT__ or window.__CLASSIFIED_LIST__
    // Also try direct DOM parsing of search result cards
    document.querySelectorAll("article.card--result, [class*='card--result'], .search-results__item, article[class*='card']").forEach(el => {
      const link = el.querySelector("a[href*='/classified/'], a[href*='/annonce/']")?.href || "";
      const idMatch = link.match(/\/(\d+)(?:\?|$)/);
      const id = idMatch ? idMatch[1] : "";
      if (!id) return;

      // Price — try multiple selectors
      const priceEl = el.querySelector("[class*='card-price'], [class*='card--result__price'], .card__information--price, span[class*='price']");
      const priceText = priceEl?.textContent?.trim() || "0";
      const price = Number(priceText.replace(/[^0-9]/g, "")) || 0;

      // Address / locality
      const localityEl = el.querySelector("[class*='card__information--locality'], [class*='card-locality'], .card__information--property-locality");
      const locality = localityEl?.textContent?.trim() || "";

      // Property type
      const typeEl = el.querySelector("[class*='card__information--property-type'], [class*='card-type']");
      const propertyType = typeEl?.textContent?.trim() || "";

      // Surface
      const surfaceEl = el.querySelector("[class*='card__information--property-surface'], [class*='card-surface']");
      const surfaceText = surfaceEl?.textContent?.trim() || "0";
      const area = parseFloat(surfaceText.replace(/[^0-9.]/g, "")) || 0;

      // Rooms / bedrooms
      const roomsEl = el.querySelector("[class*='card__information--property-rooms'], [class*='card-rooms']");
      const roomsText = roomsEl?.textContent?.trim() || "0";
      const rooms = parseInt(roomsText) || 0;

      // Image
      const imgEl = el.querySelector("img[src*='immoweb'], img[data-src], img");
      const imgSrc = imgEl?.src || imgEl?.dataset?.src || "";

      results.push({
        id,
        title: `${propertyType} - ${locality}`.trim() || `Property ${id}`,
        price,
        locality,
        propertyType,
        area,
        rooms,
        images: imgSrc && !imgSrc.includes("placeholder") ? [imgSrc] : [],
      });
    });

    return results;
  });
}

// ===== Extract detail from classified page =====
async function extractDetail(page, classifiedId) {
  const url = `https://www.immoweb.be/en/classified/${classifiedId}`;
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
    await sleep(2500);

    return await page.evaluate(() => {
      const detail = {
        title: "", price: 0, address: "", city: "", zip: "", district: "",
        area: 0, bedrooms: 0, rooms: 0, propertyType: "", subtype: "",
        images: [], latitude: 0, longitude: 0, description: "",
        epc: "", floor: 0, yearBuilt: 0,
        hasGarden: false, hasTerrace: false, hasBalcony: false, hasGarage: false, hasElevator: false,
      };

      // window.classified contains all data
      if (window.classified) {
        const c = window.classified;
        const prop = c.property || {};
        const loc = prop.location || {};
        const trans = c.transaction || {};

        detail.title = c.title || `${prop.type || "Property"} in ${loc.locality || "Belgium"}`;
        detail.price = trans.sale?.price || trans.rental?.monthlyRentalPrice || 0;
        detail.address = [loc.street, loc.number, loc.postalCode, loc.locality].filter(Boolean).join(", ");
        detail.city = loc.locality || "";
        detail.zip = loc.postalCode || "";
        detail.district = loc.district || "";
        detail.area = prop.netHabitableSurface || prop.surface || 0;
        detail.bedrooms = prop.bedroomCount || 0;
        detail.rooms = prop.roomCount || prop.bedroomCount || 0;
        detail.propertyType = prop.type || "";
        detail.subtype = prop.subtype || "";
        detail.latitude = loc.latitude || 0;
        detail.longitude = loc.longitude || 0;
        detail.epc = prop.epcScore || "";
        detail.floor = prop.floor || 0;
        detail.yearBuilt = prop.building?.constructionYear || 0;
        detail.hasGarden = prop.hasGarden || false;
        detail.hasTerrace = prop.hasTerrace || false;
        detail.hasBalcony = prop.hasBalcony || false;
        detail.hasGarage = (prop.parkingCountIndoor || 0) + (prop.parkingCountOutdoor || 0) > 0;
        detail.hasElevator = prop.hasLift || false;

        // Images from media
        detail.images = (c.media?.pictures || [])
          .map(p => p.largeUrl || p.mediumUrl || p.smallUrl)
          .filter(Boolean);
      }

      // Fallback: parse from DOM
      if (!detail.price) {
        const priceEl = document.querySelector("[class*='classified__price'], .classified__header--price, [class*='price'] span");
        const priceText = priceEl?.textContent || "0";
        detail.price = Number(priceText.replace(/[^0-9]/g, "")) || 0;
      }

      if (!detail.description) {
        const descEl = document.querySelector("[class*='classified__description'], .classified__description p");
        detail.description = descEl?.textContent?.trim()?.slice(0, 2000) || "";
      }

      if (detail.images.length === 0) {
        document.querySelectorAll("[class*='classified__gallery'] img, .classified-gallery img").forEach(img => {
          const src = img.src || img.dataset?.src || "";
          if (src && !src.includes("placeholder")) detail.images.push(src);
        });
      }

      return detail;
    });
  } catch (e) {
    console.error(`  Detail ${classifiedId}: ${e.message}`);
    return null;
  }
}

// ===== Insert property =====
async function insertProperty(prop, listingType, r2Images) {
  const iwId = String(prop.id);
  const slug = slugify(prop.title || prop.locality || `immoweb-${iwId}`) + `-iw${iwId}`;

  const { data: dup } = await sb.from("properties").select("id").eq("slug", slug).maybeSingle();
  if (dup) return { skipped: true };

  const city = prop.city || prop.locality || "Brussels";
  const epcMap = { A: "A", "A+": "A", "A++": "A", B: "B", C: "C", D: "D", E: "E", F: "F", G: "G" };

  const property = {
    slug,
    title: prop.title || `Property in ${city}`,
    listing_type: listingType,
    category: mapCategory(prop.propertyType),
    subtype: "ostatni",
    rooms_label: prop.bedrooms ? `${prop.bedrooms} ch.` : (prop.rooms ? `${prop.rooms} pcs` : ""),
    price: prop.price || 0,
    price_currency: "eur",
    price_unit: listingType === "rent" ? "za_mesic" : undefined,
    city,
    district: prop.district || "",
    zip: prop.zip || "",
    location_label: prop.address || prop.locality || city,
    latitude: prop.latitude || 0,
    longitude: prop.longitude || 0,
    area: prop.area || 0,
    floor: prop.floor || undefined,
    year_built: prop.yearBuilt || undefined,
    energy_rating: epcMap[prop.epc] || undefined,
    balcony: prop.hasBalcony || false,
    terrace: prop.hasTerrace || false,
    garden: prop.hasGarden || false,
    garage: prop.hasGarage || false,
    elevator: prop.hasElevator || false,
    summary: (prop.title || prop.locality || "").slice(0, 300),
    description: prop.description || undefined,
    image_src: r2Images[0] || "/branding/placeholder.png",
    image_alt: prop.title || `Property in ${city}`,
    images: r2Images,
    featured: false,
    active: true,
    source: "immoweb",
    country: "be",
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
  Immoweb.be Scraper v2 (Playwright) | Pages: ${PAGES} | Delay: ${DELAY_MS}ms
  Cities: ${CITIES.join(", ")}
`);

  const state = loadState();
  const t0 = Date.now();

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: UA,
    viewport: { width: 1920, height: 1080 },
    locale: "en-BE",
  });

  const page = await context.newPage();
  console.log("  Opening Immoweb...");
  await page.goto("https://www.immoweb.be/en", { waitUntil: "domcontentloaded", timeout: 30000 });
  await sleep(3000);

  // Accept cookies
  try {
    const cookieBtn = page.locator("#uc-btn-accept-banner, button:has-text('Accept'), button:has-text('Agree'), [data-testid='uc-accept-all-button']");
    if (await cookieBtn.isVisible({ timeout: 5000 })) {
      await cookieBtn.click();
      console.log("  Cookies accepted");
      await sleep(1000);
    }
  } catch {}

  const channels = [
    { path: "for-sale", type: "sale" },
    { path: "for-rent", type: "rent" },
  ];

  for (const city of CITIES) {
    for (const ch of channels) {
      const label = `${city} - ${ch.type === "sale" ? "Buy" : "Rent"}`;
      console.log(`\n== ${label} ==`);

      for (let p = 1; p <= PAGES; p++) {
        const searchUrl = `https://www.immoweb.be/en/search/house-and-apartment/${ch.path}?countries=BE&localities=${encodeURIComponent(city)}&page=${p}&orderBy=newest`;

        await sleep(DELAY_MS);
        try {
          await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 25000 });
          await sleep(3000);
        } catch (e) {
          console.error(`  Nav error: ${e.message}`);
          continue;
        }

        // Extract from search results
        const listings = await extractSearchResults(page);

        // If DOM parsing found nothing, try to get IDs from links
        let classifiedIds = listings.map(l => l.id).filter(Boolean);
        if (classifiedIds.length === 0) {
          classifiedIds = await page.evaluate(() => {
            const ids = new Set();
            document.querySelectorAll("a[href*='/classified/']").forEach(a => {
              const m = a.href.match(/\/classified\/(\d+)/);
              if (m) ids.add(m[1]);
            });
            return [...ids];
          });
        }

        if (classifiedIds.length === 0) { console.log(`  Page ${p}: empty, next city`); break; }

        console.log(`  Page ${p}: ${classifiedIds.length} classifieds`);

        for (const id of classifiedIds) {
          if (state.seen[`iw-${id}`]) { process.stdout.write("s"); continue; }

          try {
            await sleep(DELAY_MS);

            // Get full data from detail page (window.classified has everything)
            const detail = await extractDetail(page, id);
            if (!detail || (!detail.price && !detail.title)) {
              process.stdout.write("?");
              continue;
            }

            // Upload images
            const r2Urls = [];
            for (const imgUrl of (detail.images || []).slice(0, MAX_IMAGES)) {
              if (!imgUrl || imgUrl.startsWith("data:") || imgUrl.includes("placeholder")) continue;
              const url = await uploadToR2(imgUrl, slugify(detail.title || id));
              if (url) { r2Urls.push(url); state.stats.images++; }
            }

            const prop = { ...detail, id };
            const res = await insertProperty(prop, ch.type, r2Urls);
            if (res.skipped) { state.stats.skipped++; process.stdout.write("d"); }
            else { state.stats.properties++; process.stdout.write("."); }

            state.seen[`iw-${id}`] = true;
            if (state.stats.properties % 5 === 0) saveState(state);
          } catch (e) {
            state.stats.errors++;
            console.error(`\n  Err ${id}: ${e.message}`);
            process.stdout.write("x");
          }
        }

        const min = ((Date.now() - t0) / 60000).toFixed(1);
        console.log(`\n  [${min}m] Props: ${state.stats.properties} | Imgs: ${state.stats.images} | Skip: ${state.stats.skipped} | Err: ${state.stats.errors}`);
        saveState(state);
      }
    }
  }

  await browser.close();
  saveState(state);
  const totalMin = ((Date.now() - t0) / 60000).toFixed(1);
  console.log(`\n  DONE in ${totalMin}m | Properties: ${state.stats.properties} | Images: ${state.stats.images}\n`);
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
