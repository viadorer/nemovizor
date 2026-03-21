#!/usr/bin/env node
// ============================================================
// Homegate.ch Scraper -- Playwright edition
// Swiss Real Estate -- replaces immoscout24.ch (which blocks with 403)
// Usage: node scripts/scrape-immoscout24ch.mjs [--pages 5] [--delay 3000]
//
// Data sources on homegate.ch:
//   1. JSON-LD <script type="application/ld+json"> with Product schema
//   2. window.__INITIAL_STATE__ with listing data
//   3. DOM cards: div[data-test^="listing-card"]
//
// URL format: https://www.homegate.ch/kaufen/immobilien/ort-{city}/trefferliste
// Pagination: ?ep=N
// Detail: https://www.homegate.ch/kaufen/{id}
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
if (!r2) console.warn("WARNING: R2 not configured -- images skipped");

// ===== State =====
const STATE_FILE = resolve(ROOT, "scripts/.scrape-state-homegate.json");
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
  const t = String(type).toLowerCase();
  if (t.includes("wohnung") || t.includes("apartment") || t.includes("flat") || t.includes("etagenwohnung") || t.includes("penthouse") || t.includes("loft") || t.includes("maisonette") || t.includes("studio") || t.includes("attika")) return "apartment";
  if (t.includes("haus") || t.includes("house") || t.includes("einfamilienhaus") || t.includes("reihenhaus") || t.includes("doppelhaus") || t.includes("villa") || t.includes("bungalow") || t.includes("mehrfamilienhaus") || t.includes("chalet")) return "house";
  if (t.includes("grundst") || t.includes("bauland") || t.includes("land") || t.includes("plot")) return "land";
  if (t.includes("gewerbe") || t.includes("commercial") || t.includes("office") || t.includes("buero") || t.includes("laden") || t.includes("halle") || t.includes("praxis") || t.includes("gastro")) return "commercial";
  return "other";
}

// ===== Search URLs =====
const SEARCHES = [
  { url: "https://www.homegate.ch/kaufen/immobilien/ort-zuerich/trefferliste", city: "Zuerich", type: "sale", label: "Zuerich Kauf" },
  { url: "https://www.homegate.ch/kaufen/immobilien/ort-bern/trefferliste", city: "Bern", type: "sale", label: "Bern Kauf" },
  { url: "https://www.homegate.ch/kaufen/immobilien/ort-basel/trefferliste", city: "Basel", type: "sale", label: "Basel Kauf" },
  { url: "https://www.homegate.ch/kaufen/immobilien/ort-genf/trefferliste", city: "Genf", type: "sale", label: "Genf Kauf" },
  { url: "https://www.homegate.ch/kaufen/immobilien/ort-lausanne/trefferliste", city: "Lausanne", type: "sale", label: "Lausanne Kauf" },
  { url: "https://www.homegate.ch/kaufen/immobilien/ort-luzern/trefferliste", city: "Luzern", type: "sale", label: "Luzern Kauf" },
  { url: "https://www.homegate.ch/kaufen/immobilien/ort-winterthur/trefferliste", city: "Winterthur", type: "sale", label: "Winterthur Kauf" },
  { url: "https://www.homegate.ch/kaufen/immobilien/ort-st-gallen/trefferliste", city: "St. Gallen", type: "sale", label: "St. Gallen Kauf" },
];

// ===== Parse __INITIAL_STATE__ from page HTML =====
async function parseInitialState(page) {
  return await page.evaluate(() => {
    const scripts = document.querySelectorAll("script");
    for (const s of scripts) {
      const text = s.textContent || "";
      if (text.includes("__INITIAL_STATE__")) {
        try {
          let json = text
            .replace(/^[^{]*window\.__INITIAL_STATE__\s*=\s*/, "")
            .replace(/;\s*$/, "");
          json = json.replace(/\bundefined\b/g, "null");
          return JSON.parse(json);
        } catch {
          try {
            let json = text.substring(text.indexOf("{"));
            const lastBrace = json.lastIndexOf("}");
            if (lastBrace > 0) json = json.substring(0, lastBrace + 1);
            json = json.replace(/\bundefined\b/g, "null");
            return JSON.parse(json);
          } catch {
            return null;
          }
        }
      }
    }
    return null;
  });
}

// ===== Extract listings from search page =====
async function extractListings(page) {
  // Method 1: Parse JSON-LD Product entries (primary)
  const jsonLdListings = await page.evaluate(() => {
    const results = [];
    const scripts = document.querySelectorAll("script[type='application/ld+json']");
    for (const s of scripts) {
      try {
        const data = JSON.parse(s.textContent || "");
        if (data["@type"] === "Product") {
          const name = data.name || "";
          // Name format: "Title..., Address, CHF 1670000"
          let price = 0;
          const priceMatch = name.match(/CHF\s*([\d',.]+)/i);
          if (priceMatch) {
            price = Number(priceMatch[1].replace(/[^0-9]/g, "")) || 0;
          }
          // Also try offers.price
          if (!price && data.offers) {
            price = Number(String(data.offers.price || data.offers.lowPrice || "0").replace(/[^0-9]/g, "")) || 0;
          }

          const image = data.image || "";
          const description = data.description || "";

          // Extract address: typically the part before "CHF" in the name
          let address = "";
          const addressMatch = name.match(/,\s*([^,]+),\s*CHF/i);
          if (addressMatch) {
            address = addressMatch[1].trim();
          }

          // Title is typically the part before the first comma
          const title = name.split(",")[0]?.trim() || name;

          results.push({
            name,
            title,
            price,
            image: typeof image === "string" ? image : (Array.isArray(image) ? image[0] : ""),
            description,
            address,
          });
        }
      } catch {}
    }
    return results;
  });

  // Method 2: Parse __INITIAL_STATE__ for structured listing data
  const initialState = await parseInitialState(page);
  let stateListings = [];
  if (initialState) {
    // Try to find listings in the state tree
    const tryPaths = [
      initialState?.resultList?.search?.fullSearch?.result?.listings,
      initialState?.resultList?.search?.result?.listings,
      initialState?.searchResult?.listings,
      initialState?.favourites?.results,
      initialState?.listings,
      initialState?.results,
    ];
    for (const path of tryPaths) {
      if (Array.isArray(path) && path.length > 0) {
        stateListings = path;
        break;
      }
    }
    // Also try to find listings nested deeper
    if (stateListings.length === 0 && initialState) {
      for (const key of Object.keys(initialState)) {
        const val = initialState[key];
        if (val && typeof val === "object") {
          for (const subKey of Object.keys(val)) {
            const subVal = val[subKey];
            if (Array.isArray(subVal) && subVal.length > 0 && subVal[0] && (subVal[0].id || subVal[0].listingId)) {
              stateListings = subVal;
              break;
            }
          }
          if (stateListings.length > 0) break;
        }
      }
    }
  }

  // Method 3: DOM fallback -- parse listing cards with links
  const domListings = await page.evaluate(() => {
    const results = [];
    const seenIds = new Set();

    // Find listing cards
    const cards = document.querySelectorAll('div[data-test^="listing-card"]');
    for (const card of cards) {
      const link = card.querySelector('a[href*="/kaufen/"]') || card.querySelector('a[href*="/mieten/"]');
      if (!link) continue;

      const href = link.href || "";
      const idMatch = href.match(/\/(?:kaufen|mieten)\/(\d+)/);
      if (!idMatch) continue;

      const id = idMatch[1];
      if (seenIds.has(id)) continue;
      seenIds.add(id);

      // Try to extract text content from the card
      const titleEl = card.querySelector("h3, h2, [class*='Title'], [class*='title']");
      const title = titleEl?.textContent?.trim() || "";

      const priceEl = card.querySelector("[class*='Price'], [class*='price']");
      const priceText = priceEl?.textContent?.trim() || "0";
      const price = Number(priceText.replace(/[^0-9]/g, "")) || 0;

      const addressEl = card.querySelector("[class*='Address'], [class*='address'], [class*='Location'], [class*='location']");
      const address = addressEl?.textContent?.trim() || "";

      let area = 0;
      let rooms = 0;
      card.querySelectorAll("span, li, [class*='Attribute'], [class*='attribute']").forEach(el => {
        const txt = el.textContent?.trim() || "";
        if ((txt.includes("m2") || txt.includes("m\u00B2")) && !txt.includes("Zi")) {
          area = parseFloat(txt.replace(/[^0-9.,]/g, "").replace(",", ".")) || 0;
        }
        if (txt.includes("Zimmer") || txt.includes("Zi") || /^\d+(\.\d+)?\s*(Zi|Zimmer|rooms?)/i.test(txt)) {
          rooms = parseFloat(txt.replace(/[^0-9.,]/g, "").replace(",", ".")) || 0;
        }
      });

      const imgEl = card.querySelector("img[src], img[data-src]");
      const imgSrc = imgEl?.src || imgEl?.dataset?.src || "";

      results.push({
        id,
        title: title || address,
        price,
        address,
        area,
        rooms,
        images: imgSrc && !imgSrc.includes("placeholder") && !imgSrc.includes("logo") ? [imgSrc] : [],
      });
    }

    // Also try generic link-based extraction if cards selector didnt work
    if (results.length === 0) {
      const links = document.querySelectorAll('a[href*="/kaufen/"], a[href*="/mieten/"]');
      for (const link of links) {
        const href = link.href || "";
        const idMatch = href.match(/\/(?:kaufen|mieten)\/(\d+)/);
        if (!idMatch) continue;
        const id = idMatch[1];
        if (seenIds.has(id)) continue;
        seenIds.add(id);
        results.push({
          id,
          title: link.textContent?.trim()?.slice(0, 200) || "",
          price: 0,
          address: "",
          area: 0,
          rooms: 0,
          images: [],
        });
      }
    }

    return results;
  });

  // Merge data sources: use DOM/link IDs as the base, enrich with JSON-LD/state data
  // If we have DOM listings with IDs, those are authoritative for the ID
  if (domListings.length > 0) {
    console.log(`    [DOM] Found ${domListings.length} listing cards`);

    // If JSON-LD has data, try to match by index (they typically appear in the same order)
    if (jsonLdListings.length > 0) {
      console.log(`    [JSON-LD] Found ${jsonLdListings.length} Product entries, merging`);
      for (let i = 0; i < domListings.length && i < jsonLdListings.length; i++) {
        const jl = jsonLdListings[i];
        if (jl.title && !domListings[i].title) domListings[i].title = jl.title;
        if (jl.price && !domListings[i].price) domListings[i].price = jl.price;
        if (jl.image && domListings[i].images.length === 0) domListings[i].images = [jl.image];
        if (jl.address && !domListings[i].address) domListings[i].address = jl.address;
      }
    }

    return domListings.map(item => ({
      id: item.id,
      title: item.title || "",
      price: item.price || 0,
      address: item.address || "",
      city: "",
      area: item.area || 0,
      rooms: item.rooms || 0,
      propertyType: "",
      images: item.images || [],
      latitude: 0,
      longitude: 0,
    }));
  }

  // If no DOM listings but we have state listings, use those
  if (stateListings.length > 0) {
    console.log(`    [__INITIAL_STATE__] Found ${stateListings.length} listings in JSON`);
    return stateListings.map(item => {
      const listing = item.listing || item;
      const id = String(listing.id || listing.listingId || listing.propertyId || "");
      const price = Number(
        listing.sellingPrice || listing.price || listing.rentGross || listing.rentNet
        || String(listing.priceFormatted || "0").replace(/[^0-9]/g, "")
      ) || 0;
      const rawImages = listing.images || listing.pictures || listing.media || [];
      const images = (Array.isArray(rawImages) ? rawImages : [])
        .map(img => typeof img === "string" ? img : (img?.url || img?.src || img?.file || ""))
        .filter(u => u && !u.includes("placeholder") && !u.includes("logo"));
      return {
        id,
        title: listing.title || listing.name || "",
        price,
        address: listing.street || listing.address || "",
        city: listing.cityName || listing.city || listing.locality || "",
        area: parseFloat(listing.surfaceLiving || listing.livingSpace || listing.area || "0") || 0,
        rooms: parseFloat(listing.numberOfRooms || listing.rooms || "0") || 0,
        propertyType: String(listing.propertyType || listing.objectType || ""),
        images,
        latitude: parseFloat(listing.latitude || listing.lat || "0") || 0,
        longitude: parseFloat(listing.longitude || listing.lng || "0") || 0,
      };
    }).filter(item => item.id);
  }

  // If only JSON-LD products, we still need IDs from the page links
  if (jsonLdListings.length > 0) {
    console.log(`    [JSON-LD only] Found ${jsonLdListings.length} Product entries (no IDs from DOM)`);
  }

  console.log("    No listings found from any method");
  return [];
}

// ===== Extract detail from listing page =====
async function extractDetail(page, listingId) {
  const url = `https://www.homegate.ch/kaufen/${listingId}`;
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
    await sleep(2000);

    const detail = {
      images: [], description: "", area: 0, rooms: 0,
      floor: 0, totalFloors: 0, yearBuilt: 0,
      latitude: 0, longitude: 0,
      balcony: false, garden: false, cellar: false, elevator: false,
      condition: "", propertyType: "",
    };

    // Method 1: JSON-LD on detail page
    const jsonLdDetail = await page.evaluate(() => {
      const d = { images: [], area: 0, rooms: 0, latitude: 0, longitude: 0, propertyType: "", description: "", price: 0 };
      const scripts = document.querySelectorAll("script[type='application/ld+json']");
      for (const s of scripts) {
        try {
          const data = JSON.parse(s.textContent || "");
          const types = ["Product", "Residence", "Apartment", "House", "SingleFamilyResidence", "RealEstateListing", "Place"];
          if (types.includes(data["@type"])) {
            d.description = data.description || "";
            d.images = data.image ? (Array.isArray(data.image) ? data.image : [data.image]) : [];
            if (data.geo) {
              d.latitude = parseFloat(data.geo.latitude || "0") || 0;
              d.longitude = parseFloat(data.geo.longitude || "0") || 0;
            }
            d.propertyType = data["@type"] || "";
            if (data.floorSize) d.area = parseFloat(data.floorSize.value || "0") || 0;
            if (data.numberOfRooms) d.rooms = parseInt(data.numberOfRooms || "0") || 0;
          }
        } catch {}
      }
      return d;
    });
    if (jsonLdDetail) {
      if (jsonLdDetail.images.length > 0) detail.images = jsonLdDetail.images;
      if (jsonLdDetail.description) detail.description = jsonLdDetail.description.slice(0, 2000);
      if (jsonLdDetail.latitude) detail.latitude = jsonLdDetail.latitude;
      if (jsonLdDetail.longitude) detail.longitude = jsonLdDetail.longitude;
      if (jsonLdDetail.area) detail.area = jsonLdDetail.area;
      if (jsonLdDetail.rooms) detail.rooms = jsonLdDetail.rooms;
      if (jsonLdDetail.propertyType) detail.propertyType = jsonLdDetail.propertyType;
    }

    // Method 2: __INITIAL_STATE__ on detail page
    const state = await parseInitialState(page);
    if (state) {
      // Try to find the listing data in the state
      const listing = state?.listing || state?.listingDetail?.listing
        || state?.propertyDetail?.listing || state?.property || null;
      if (listing) {
        const chars = listing.characteristics || {};
        if (!detail.area) detail.area = parseFloat(listing.surfaceLiving || chars.livingSpace || listing.livingSpace || listing.area || "0") || 0;
        if (!detail.rooms) detail.rooms = parseFloat(listing.numberOfRooms || chars.numberOfRooms || listing.rooms || "0") || 0;
        if (!detail.latitude) detail.latitude = parseFloat(listing.latitude || listing.lat || "0") || 0;
        if (!detail.longitude) detail.longitude = parseFloat(listing.longitude || listing.lng || "0") || 0;
        if (!detail.yearBuilt) detail.yearBuilt = parseInt(listing.yearBuilt || chars.yearBuilt || chars.buildYear || "0") || 0;
        if (!detail.floor) detail.floor = parseInt(listing.floor || chars.floor || "0") || 0;
        if (!detail.totalFloors) detail.totalFloors = parseInt(listing.numberOfFloors || chars.numberOfFloors || "0") || 0;
        if (!detail.propertyType) detail.propertyType = String(listing.propertyType || listing.objectType || "");

        // Images from state
        if (detail.images.length === 0) {
          const rawImages = listing.images || listing.pictures || listing.media || [];
          if (Array.isArray(rawImages)) {
            detail.images = rawImages
              .map(img => typeof img === "string" ? img : (img?.url || img?.src || img?.file || ""))
              .filter(u => u && !u.includes("placeholder") && !u.includes("logo") && !u.includes("avatar"));
          }
        }

        // Description from state
        if (!detail.description) {
          const desc = listing.description || listing.descriptionText || listing.text || "";
          if (typeof desc === "object") {
            detail.description = String(desc.de || desc.en || desc.fr || Object.values(desc)[0] || "").slice(0, 2000);
          } else {
            detail.description = String(desc).slice(0, 2000);
          }
        }

        // Features
        if (chars && typeof chars === "object") {
          const charStr = JSON.stringify(chars).toLowerCase();
          detail.balcony = Boolean(chars.hasBalcony || chars.balcony || charStr.includes('"balkon"') || charStr.includes('"balcony"'));
          detail.garden = Boolean(chars.hasGarden || chars.garden || charStr.includes('"garten"') || charStr.includes('"garden"'));
          detail.cellar = Boolean(chars.hasCellar || chars.cellar || charStr.includes('"keller"') || charStr.includes('"cellar"'));
          detail.elevator = Boolean(chars.hasElevator || chars.hasLift || chars.elevator || chars.lift || charStr.includes('"aufzug"') || charStr.includes('"lift"') || charStr.includes('"elevator"'));
        }
      }
    }

    // Method 3: DOM scraping fallback
    const domDetail = await page.evaluate(() => {
      const d = {
        images: [], description: "", area: 0, rooms: 0,
        floor: 0, totalFloors: 0, yearBuilt: 0,
        latitude: 0, longitude: 0,
        balcony: false, garden: false, cellar: false, elevator: false,
      };

      // Gallery images
      document.querySelectorAll("[class*='Gallery'] img, [class*='gallery'] img, [class*='Slider'] img, [class*='slider'] img, [class*='carousel'] img, [class*='Image'] img, picture img").forEach(img => {
        const src = img.dataset?.src || img.src || img.dataset?.lazySrc || img.currentSrc || "";
        if (src && !src.includes("placeholder") && !src.includes("avatar") && !src.includes("logo") && (src.startsWith("http") || src.startsWith("//"))) {
          const fullSrc = src.startsWith("//") ? `https:${src}` : src;
          if (!d.images.includes(fullSrc)) d.images.push(fullSrc);
        }
      });

      // Feature table
      document.querySelectorAll("dl, table, [class*='Feature'], [class*='feature'], [class*='Detail'] [class*='row'], [class*='Attribute'], [class*='Criteria']").forEach(el => {
        const pairs = [];
        const dts = el.querySelectorAll("dt");
        const dds = el.querySelectorAll("dd");
        dts.forEach((dt, i) => {
          pairs.push({ label: dt.textContent?.trim()?.toLowerCase() || "", value: dds[i]?.textContent?.trim() || "" });
        });
        el.querySelectorAll("tr").forEach(tr => {
          const cells = tr.querySelectorAll("td, th");
          if (cells.length >= 2) {
            pairs.push({ label: cells[0].textContent?.trim()?.toLowerCase() || "", value: cells[1].textContent?.trim() || "" });
          }
        });

        for (const { label, value } of pairs) {
          if (label.includes("wohnfl") || label.includes("living space") || label.includes("surface habitable") || label.includes("flache") || label.includes("fl\u00E4che")) d.area = parseFloat(value) || d.area;
          if (label.includes("zimmer") || label.includes("rooms") || label.includes("pieces") || label.includes("pi\u00E8ces")) d.rooms = parseFloat(value) || d.rooms;
          if (label.includes("stockwerk") || label.includes("etage") || label.includes("floor")) d.floor = parseInt(value) || d.floor;
          if ((label.includes("geschosse") || label.includes("etagen") || label.includes("floors")) && !label.includes("stockwerk")) d.totalFloors = parseInt(value) || d.totalFloors;
          if (label.includes("baujahr") || label.includes("year") || label.includes("annee") || label.includes("ann\u00E9e")) d.yearBuilt = parseInt(value) || d.yearBuilt;
        }
      });

      // Features from tags/chips
      document.querySelectorAll("[class*='Tag'], [class*='tag'], [class*='Chip'], [class*='chip'], [class*='Feature'] li, [class*='feature'] li, [class*='Amenity'], [class*='amenity']").forEach(el => {
        const txt = el.textContent?.trim()?.toLowerCase() || "";
        if (txt.includes("balkon") || txt.includes("balcony") || txt.includes("balcon")) d.balcony = true;
        if (txt.includes("garten") || txt.includes("garden") || txt.includes("jardin")) d.garden = true;
        if (txt.includes("keller") || txt.includes("cellar") || txt.includes("cave")) d.cellar = true;
        if (txt.includes("lift") || txt.includes("aufzug") || txt.includes("elevator") || txt.includes("ascenseur")) d.elevator = true;
      });

      // Description
      const descEl = document.querySelector("[class*='Description'], [class*='description'], [data-test='description'], [class*='ObjectText'], [class*='listing-text']");
      d.description = descEl?.textContent?.trim()?.slice(0, 2000) || "";

      return d;
    });

    // Merge DOM detail into main detail (only fill gaps)
    if (detail.images.length === 0 && domDetail.images.length > 0) detail.images = domDetail.images;
    if (!detail.description && domDetail.description) detail.description = domDetail.description;
    if (!detail.area && domDetail.area) detail.area = domDetail.area;
    if (!detail.rooms && domDetail.rooms) detail.rooms = domDetail.rooms;
    if (!detail.floor && domDetail.floor) detail.floor = domDetail.floor;
    if (!detail.totalFloors && domDetail.totalFloors) detail.totalFloors = domDetail.totalFloors;
    if (!detail.yearBuilt && domDetail.yearBuilt) detail.yearBuilt = domDetail.yearBuilt;
    if (domDetail.balcony) detail.balcony = true;
    if (domDetail.garden) detail.garden = true;
    if (domDetail.cellar) detail.cellar = true;
    if (domDetail.elevator) detail.elevator = true;

    console.log(`    [detail] area=${detail.area} rooms=${detail.rooms} imgs=${detail.images.length} lat=${detail.latitude}`);
    return detail;
  } catch (e) {
    console.error(`  Detail ${listingId}: ${e.message}`);
    return null;
  }
}

// ===== Insert property =====
async function insertProperty(prop, search, r2Images) {
  const hgId = String(prop.id);
  const slug = slugify(prop.title || prop.address || `immobilie-${hgId}`) + `-hg${hgId}`;

  const { data: dup } = await sb.from("properties").select("id").eq("slug", slug).maybeSingle();
  if (dup) return { skipped: true };

  const city = prop.city || search.city;
  const rooms = prop.rooms || 0;

  const property = {
    slug,
    title: prop.title || `Immobilie in ${city}`,
    listing_type: search.type,
    category: mapCategory(prop.propertyType),
    subtype: "ostatni",
    rooms_label: rooms > 0 ? `${rooms} Zi.` : "",
    price: prop.price || 0,
    price_currency: "chf",
    price_unit: search.type === "rent" ? "za_mesic" : undefined,
    city,
    district: prop.district || "",
    location_label: [prop.address, city].filter(Boolean).join(", ") || city,
    latitude: prop.latitude || 0,
    longitude: prop.longitude || 0,
    area: prop.area || 0,
    floor: prop.floor || undefined,
    total_floors: prop.totalFloors || undefined,
    year_built: prop.yearBuilt || undefined,
    balcony: prop.balcony || false,
    garden: prop.garden || false,
    cellar: prop.cellar || false,
    elevator: prop.elevator || false,
    summary: (prop.title || prop.address || "").slice(0, 300),
    description: prop.description || undefined,
    image_src: r2Images[0] || "/branding/placeholder.png",
    image_alt: prop.title || `Immobilie in ${city}`,
    images: r2Images,
    featured: false,
    active: true,
    source: "homegate",
    country: "ch",
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
  Homegate.ch Scraper (Playwright) | Pages: ${PAGES} | Delay: ${DELAY_MS}ms
  Searches: ${SEARCHES.map(s => s.label).join(", ")}
`);

  const state = loadState();
  const t0 = Date.now();

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: UA,
    viewport: { width: 1920, height: 1080 },
    locale: "de-CH",
    geolocation: { latitude: 47.3769, longitude: 8.5417 }, // Zurich
    permissions: ["geolocation"],
  });

  const page = await context.newPage();
  console.log("  Opening Homegate.ch...");
  await page.goto("https://www.homegate.ch", { waitUntil: "domcontentloaded", timeout: 30000 });
  await sleep(3000);

  // Accept/decline cookies
  try {
    const declineBtn = page.locator("button:has-text('Ablehnen'), button:has-text('Decline'), button:has-text('Nur notwendige'), button:has-text('Reject')");
    if (await declineBtn.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await declineBtn.first().click();
      console.log("  Cookies declined");
      await sleep(1000);
    } else {
      const cookieBtn = page.locator("button:has-text('Akzeptieren'), button:has-text('Accept'), button:has-text('Alle akzeptieren'), button:has-text('OK'), [id*='accept'], [class*='accept']");
      if (await cookieBtn.first().isVisible({ timeout: 5000 }).catch(() => false)) {
        await cookieBtn.first().click();
        console.log("  Cookies accepted");
        await sleep(1000);
      }
    }
  } catch {}

  // Check access
  const testTitle = await page.title();
  console.log(`  Page title: ${testTitle}`);
  if (testTitle.includes("blocked") || testTitle.includes("Access Denied") || testTitle.includes("403")) {
    console.error("  BLOCKED: Site is blocking headless browser.");
    await browser.close();
    process.exit(1);
  }

  for (const search of SEARCHES) {
    console.log(`\n== ${search.label} ==`);

    for (let p = 1; p <= PAGES; p++) {
      const pageUrl = p === 1 ? search.url : `${search.url}?ep=${p}`;

      await sleep(DELAY_MS);
      try {
        await page.goto(pageUrl, { waitUntil: "domcontentloaded", timeout: 25000 });
        await sleep(3000);

        // Wait for listing cards to appear
        try {
          await page.waitForSelector('div[data-test^="listing-card"], a[href*="/kaufen/"], a[href*="/mieten/"]', { timeout: 5000 });
        } catch {
          // Content may be in JSON-LD or __INITIAL_STATE__, continue
        }

        // Check for CAPTCHA
        const hasCaptcha = await page.locator("#captcha, .geetest_holder, [class*='captcha'], [class*='Captcha']").isVisible({ timeout: 2000 }).catch(() => false);
        if (hasCaptcha) {
          console.log("  CAPTCHA detected, waiting 30s...");
          await sleep(30000);
        }
      } catch (e) {
        console.error(`  Nav error: ${e.message}`);
        continue;
      }

      const listings = await extractListings(page);
      if (listings.length === 0) { console.log(`  Page ${p}: empty, next`); break; }

      console.log(`  Page ${p}: ${listings.length} listings`);

      for (const prop of listings) {
        const hgId = String(prop.id);
        if (!hgId || state.seen[`hg-${hgId}`]) { process.stdout.write("s"); continue; }

        try {
          // Detail page
          const detail = await extractDetail(page, hgId);
          if (detail) {
            if (detail.images.length > 0) prop.images = detail.images;
            if (detail.latitude) prop.latitude = detail.latitude;
            if (detail.longitude) prop.longitude = detail.longitude;
            if (detail.area) prop.area = detail.area;
            if (detail.rooms) prop.rooms = detail.rooms;
            if (detail.floor) prop.floor = detail.floor;
            if (detail.totalFloors) prop.totalFloors = detail.totalFloors;
            if (detail.yearBuilt) prop.yearBuilt = detail.yearBuilt;
            if (detail.description) prop.description = detail.description;
            if (detail.propertyType) prop.propertyType = detail.propertyType;
            prop.balcony = detail.balcony;
            prop.garden = detail.garden;
            prop.cellar = detail.cellar;
            prop.elevator = detail.elevator;
          }

          await sleep(DELAY_MS);

          // Upload images
          const r2Urls = [];
          for (const imgUrl of (prop.images || []).slice(0, MAX_IMAGES)) {
            if (!imgUrl || imgUrl.startsWith("data:") || imgUrl.includes("placeholder")) continue;
            const url = await uploadToR2(imgUrl, slugify(prop.title || hgId));
            if (url) { r2Urls.push(url); state.stats.images++; }
          }

          const res = await insertProperty(prop, search, r2Urls);
          if (res.skipped) { state.stats.skipped++; process.stdout.write("d"); }
          else { state.stats.properties++; process.stdout.write("."); }

          state.seen[`hg-${hgId}`] = true;
          if (state.stats.properties % 5 === 0) saveState(state);
        } catch (e) {
          state.stats.errors++;
          console.error(`\n  Err ${hgId}: ${e.message}`);
          process.stdout.write("x");
        }
      }

      const min = ((Date.now() - t0) / 60000).toFixed(1);
      console.log(`\n  [${min}m] Props: ${state.stats.properties} | Imgs: ${state.stats.images} | Skip: ${state.stats.skipped} | Err: ${state.stats.errors}`);
      saveState(state);
    }
  }

  await browser.close();
  saveState(state);
  const totalMin = ((Date.now() - t0) / 60000).toFixed(1);
  console.log(`\n  DONE in ${totalMin}m | Properties: ${state.stats.properties} | Images: ${state.stats.images}\n`);
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
