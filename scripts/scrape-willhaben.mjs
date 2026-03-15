#!/usr/bin/env node
// ============================================================
// willhaben.at Scraper v2 -- Playwright edition
// Austrian Real Estate -- headless browser
// Usage: node scripts/scrape-willhaben.mjs [--pages 5] [--delay 3000]
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
const STATE_FILE = resolve(ROOT, "scripts/.scrape-state-willhaben.json");
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
  if (t.includes("wohnung") || t.includes("apartment") || t.includes("etagenwohnung") || t.includes("penthouse") || t.includes("loft") || t.includes("maisonette") || t.includes("mietwohnung") || t.includes("eigentumswohnung")) return "apartment";
  if (t.includes("haus") || t.includes("einfamilienhaus") || t.includes("reihenhaus") || t.includes("doppelhaus") || t.includes("villa") || t.includes("bungalow") || t.includes("mehrfamilienhaus")) return "house";
  if (t.includes("grundst") || t.includes("grundstueck") || t.includes("grundstuck")) return "land";
  if (t.includes("gewerbe") || t.includes("buero") || t.includes("laden") || t.includes("halle") || t.includes("praxis")) return "commercial";
  return "other";
}

// ===== Searches =====
const SEARCHES = [
  { url: "https://www.willhaben.at/iad/immobilien/eigentumswohnung/eigentumswohnung-angebote", city: "Wien", type: "sale", label: "Kauf Wohnung" },
  { url: "https://www.willhaben.at/iad/immobilien/mietwohnungen/mietwohnung-angebote", city: "Wien", type: "rent", label: "Miete Wohnung" },
  { url: "https://www.willhaben.at/iad/immobilien/haus-kaufen/haus-angebote", city: "Wien", type: "sale", label: "Kauf Haus" },
  { url: "https://www.willhaben.at/iad/immobilien/haus-mieten/haus-angebote", city: "Wien", type: "rent", label: "Miete Haus" },
  { url: "https://www.willhaben.at/iad/immobilien/grundstuecke/grundstueck-angebote", city: "Wien", type: "sale", label: "Grundstuecke" },
];

// ===== Helper: get attribute value from willhaben attribute array =====
function whAttr(attributes, name) {
  if (!attributes || !Array.isArray(attributes)) return "";
  for (const attr of attributes) {
    if (!attr) continue;
    // willhaben uses attribute arrays with name/values structure
    const attrName = attr.name || attr.attributeName || "";
    if (attrName.toLowerCase() === name.toLowerCase()) {
      // values can be an array of strings
      const vals = attr.values || attr.value || [];
      if (Array.isArray(vals)) return vals[0] || "";
      return String(vals);
    }
  }
  return "";
}

// ===== Extract listings from search page =====
// willhaben is a Next.js app; data lives in __NEXT_DATA__ or in
// window.__NEXT_DATA__ at runtime. We also check for a global
// searchResult / window.__wh__ object that some pages expose.
async function extractListings(page) {
  return await page.evaluate(() => {
    const results = [];

    // -----------------------------------------------------------
    // Helper: read a willhaben attribute value from an attribute
    // array. Willhaben stores attributes as:
    //   { name: "PRICE", values: ["350000"] }
    //   or { name: "ESTATE_SIZE", values: ["75"] }
    // -----------------------------------------------------------
    function getAttr(attrs, name) {
      if (!attrs || !Array.isArray(attrs)) return "";
      for (const a of attrs) {
        const n = (a.name || a.attributeName || "").toUpperCase();
        if (n === name.toUpperCase()) {
          const v = a.values || a.value || [];
          return Array.isArray(v) ? (v[0] || "") : String(v);
        }
      }
      return "";
    }

    function getAttrNum(attrs, name) {
      const v = getAttr(attrs, name);
      return parseFloat(String(v).replace(",", ".")) || 0;
    }

    // -----------------------------------------------------------
    // Method 1: __NEXT_DATA__ JSON (primary for willhaben)
    // -----------------------------------------------------------
    try {
      const nextDataEl = document.getElementById("__NEXT_DATA__");
      if (nextDataEl) {
        const nd = JSON.parse(nextDataEl.textContent || "{}");
        // Navigate to the search result data - willhaben nests it
        // inside props.pageProps.searchResult or similar
        const pageProps = nd.props?.pageProps || {};
        const searchResult = pageProps.searchResult || pageProps.searchResults || pageProps.data?.searchResult || {};
        const advertList =
          searchResult.advertSummaryList?.advertSummary ||
          searchResult.resultList ||
          searchResult.ads ||
          searchResult.rows ||
          [];

        for (const ad of advertList) {
          const adId = String(ad.id || ad.adId || ad.verticalId || "");
          if (!adId) continue;

          const attrs = ad.attributes?.attribute || ad.attributes || ad.attributeList || [];
          const title = ad.description || ad.title || getAttr(attrs, "HEADING") || getAttr(attrs, "TITLE") || "";
          const price = getAttrNum(attrs, "PRICE") || getAttrNum(attrs, "PRICE/FOR_SALE") || getAttrNum(attrs, "PRICE_FOR_DISPLAY") || 0;
          const area = getAttrNum(attrs, "ESTATE_SIZE") || getAttrNum(attrs, "ESTATE_SIZE/LIVING_AREA") || getAttrNum(attrs, "LIVING_AREA") || 0;
          const rooms = getAttrNum(attrs, "NUMBER_OF_ROOMS") || getAttrNum(attrs, "ROOMS") || 0;
          const address = getAttr(attrs, "ADDRESS") || getAttr(attrs, "LOCATION") || getAttr(attrs, "POSTCODE") || "";
          const city = getAttr(attrs, "LOCATION") || getAttr(attrs, "DISTRICT") || "";
          const propertyType = getAttr(attrs, "PROPERTY_TYPE") || getAttr(attrs, "ESTATE_TYPE") || getAttr(attrs, "OBJECT_TYPE") || "";
          let lat = 0, lng = 0;
          // COORDINATES can be: values: ["lat", "lon"] or values: ["lat,lon"] or separate LATITUDE/LONGITUDE attrs
          const coordAttr = (attrs || []).find(a => (a.name || a.attributeName || "").toUpperCase() === "COORDINATES");
          if (coordAttr) {
            const vals = coordAttr.values || coordAttr.value || [];
            if (Array.isArray(vals) && vals.length >= 2) {
              lat = parseFloat(String(vals[0]).replace(",", ".")) || 0;
              lng = parseFloat(String(vals[1]).replace(",", ".")) || 0;
            } else if (Array.isArray(vals) && vals.length === 1) {
              // "lat,lon" in single string
              const parts = String(vals[0]).split(",");
              if (parts.length >= 2) {
                lat = parseFloat(parts[0]) || 0;
                lng = parseFloat(parts[1]) || 0;
              }
            }
          }
          if (!lng) {
            lat = getAttrNum(attrs, "LATITUDE") || getAttrNum(attrs, "GEO_LATITUDE") || lat;
            lng = getAttrNum(attrs, "LONGITUDE") || getAttrNum(attrs, "GEO_LONGITUDE") || 0;
          }

          // Images from advertImage list
          const imgList = ad.advertImageList?.advertImage || ad.images || ad.imageList || [];
          const images = [];
          for (const img of imgList) {
            const src = img.mainImageUrl || img.referenceImageUrl || img.url || img.selfLink ||
              (typeof img === "string" ? img : "");
            if (src && !src.includes("placeholder") && !src.includes("static/svg")) {
              // willhaben image URLs: use the largest available size
              const fullSrc = src.includes("/") ? src.replace(/\/\d+x\d+/, "/1200x900") : src;
              images.push(fullSrc);
            }
          }

          // Detail URL from context links
          let detailUrl = "";
          const ctxLinks = ad.contextLinkList?.contextLink || ad.contextLinks || ad.links || [];
          for (const link of ctxLinks) {
            const uri = link.uri || link.url || link.relativePath || "";
            if (uri && (uri.includes("/iad/") || uri.includes("/d/"))) {
              detailUrl = uri.startsWith("http") ? uri : "https://www.willhaben.at" + uri;
              break;
            }
          }
          // Fallback: construct URL from ad ID
          if (!detailUrl) {
            detailUrl = `https://www.willhaben.at/iad/object?adId=${adId}`;
          }

          // Also try selfLink or seoUrl
          if (!detailUrl || detailUrl.includes("?adId=")) {
            const seoUrl = ad.selfLink || ad.seoUrl || ad.canonicalUrl || "";
            if (seoUrl) {
              detailUrl = seoUrl.startsWith("http") ? seoUrl : "https://www.willhaben.at" + seoUrl;
            }
          }

          results.push({
            id: adId,
            title,
            price,
            address,
            city,
            area,
            rooms,
            propertyType,
            images,
            latitude: lat,
            longitude: lng,
            detailUrl,
          });
        }

        if (results.length > 0) return results;
      }
    } catch (e) {
      console.warn("__NEXT_DATA__ parse error:", e.message);
    }

    // -----------------------------------------------------------
    // Method 2: Try window-level JS state objects
    // willhaben may expose data via window.__wh__ or
    // window.__INITIAL_STATE__ or window.__DATA__
    // -----------------------------------------------------------
    try {
      const whData = window.__wh__ || window.__INITIAL_STATE__ || window.__DATA__ || null;
      if (whData) {
        const ads = whData.searchResult?.advertSummaryList?.advertSummary ||
          whData.ads || whData.results || whData.listings || [];
        for (const ad of ads) {
          const adId = String(ad.id || ad.adId || "");
          if (!adId) continue;
          const attrs = ad.attributes?.attribute || ad.attributes || [];

          function ga(name) {
            for (const a of attrs) {
              if ((a.name || "").toUpperCase() === name.toUpperCase()) {
                const v = a.values || a.value || [];
                return Array.isArray(v) ? (v[0] || "") : String(v);
              }
            }
            return "";
          }

          results.push({
            id: adId,
            title: ad.description || ad.title || ga("HEADING") || "",
            price: parseFloat(ga("PRICE")) || 0,
            address: ga("ADDRESS") || ga("LOCATION") || "",
            city: ga("LOCATION") || "",
            area: parseFloat(ga("ESTATE_SIZE")) || 0,
            rooms: parseFloat(ga("NUMBER_OF_ROOMS")) || 0,
            propertyType: ga("PROPERTY_TYPE") || "",
            images: (ad.advertImageList?.advertImage || []).map(i => i.mainImageUrl || i.url || "").filter(Boolean),
            latitude: 0,
            longitude: 0,
            detailUrl: "",
          });
        }
        if (results.length > 0) return results;
      }
    } catch {}

    // -----------------------------------------------------------
    // Method 3: Try JSON-LD (unlikely on willhaben but fallback)
    // -----------------------------------------------------------
    try {
      const scripts = document.querySelectorAll("script[type='application/ld+json']");
      for (const s of scripts) {
        const data = JSON.parse(s.textContent || "");
        if (data["@type"] === "ItemList" && data.itemListElement) {
          for (const item of data.itemListElement) {
            const offer = item.item || item;
            const urlStr = offer.url || "";
            const idMatch = urlStr.match(/\/(\d+)\/?$/);
            results.push({
              id: String(offer["@id"] || (idMatch ? idMatch[1] : "") || ""),
              title: offer.name || "",
              price: Number(String(offer.offers?.price || "0").replace(/[^0-9]/g, "")) || 0,
              address: offer.address?.streetAddress || offer.address?.addressLocality || "",
              city: offer.address?.addressLocality || "",
              area: parseFloat(offer.floorSize?.value || "0") || 0,
              rooms: parseInt(offer.numberOfRooms || "0") || 0,
              propertyType: offer["@type"] || "",
              images: offer.image ? (Array.isArray(offer.image) ? offer.image : [offer.image]) : [],
              latitude: parseFloat(offer.geo?.latitude || "0") || 0,
              longitude: parseFloat(offer.geo?.longitude || "0") || 0,
              detailUrl: urlStr,
            });
          }
        }
      }
      if (results.length > 0) return results;
    } catch {}

    // -----------------------------------------------------------
    // Method 4: Parse rendered DOM cards
    // willhaben listing cards are typically rendered as:
    //   <a href="/iad/immobilien/d/..." data-ad-id="..." ...>
    //   or inside [id^="search-result-entry-header"]
    //   or [data-testid="search-result-entry"]
    //   or [data-testid="ad-list-item"]
    // -----------------------------------------------------------
    const cardSelectors = [
      "[data-testid='search-result-entry']",
      "[data-testid='ad-list-item']",
      "[id^='search-result-entry']",
      "a[href*='/iad/immobilien/d/']",
      "article[data-ad-id]",
      "[class*='SearchResultEntry']",
      "[class*='search-result-entry']",
    ];

    let cards = [];
    for (const sel of cardSelectors) {
      cards = document.querySelectorAll(sel);
      if (cards.length > 0) break;
    }

    // If no specific cards found, look for links to detail pages
    if (cards.length === 0) {
      cards = document.querySelectorAll("a[href*='/iad/']");
    }

    const seenIds = new Set();
    cards.forEach(el => {
      // Find the link element
      const linkEl = el.tagName === "A" ? el : el.querySelector("a[href*='/iad/']") || el.querySelector("a[href]");
      const href = linkEl?.href || linkEl?.getAttribute("href") || el.getAttribute("href") || "";

      // Extract ID from URL -- willhaben URLs end with /NUMERIC_ID/
      const idMatch = href.match(/\/(\d{6,})\/?(?:\?|$|#)/);
      const adId = idMatch ? idMatch[1] : (el.dataset.adId || el.getAttribute("data-ad-id") || el.dataset.id || "");
      if (!adId || seenIds.has(adId)) return;
      seenIds.add(adId);

      // Get the full card container -- walk up from link if needed
      const card = el.closest("[data-testid='search-result-entry']") ||
        el.closest("[data-testid='ad-list-item']") ||
        el.closest("[id^='search-result-entry']") ||
        el.closest("article") || el;

      const allText = card.textContent || "";

      // Title: look for heading elements inside the card
      const titleEl = card.querySelector("h2, h3, h1, [data-testid*='title'], [data-testid*='heading']");
      const title = titleEl?.textContent?.trim() || "";

      // Price: look for price patterns in text
      let price = 0;
      const priceEl = card.querySelector("[data-testid*='price'], [class*='rice']");
      if (priceEl) {
        price = Number(priceEl.textContent.replace(/[^0-9]/g, "")) || 0;
      } else {
        // Parse price from text like "EUR 350.000" or "350.000,-"
        const priceMatch = allText.match(/(?:EUR|eur|\u20AC)\s*([\d.,]+)|(\d[\d.,]+)\s*(?:,-|EUR|\u20AC)/);
        if (priceMatch) {
          const raw = (priceMatch[1] || priceMatch[2] || "").replace(/\./g, "").replace(",", ".");
          price = parseFloat(raw) || 0;
        }
      }

      // Area
      let area = 0;
      const areaMatch = allText.match(/([\d.,]+)\s*m\u00B2/);
      if (areaMatch) area = parseFloat(areaMatch[1].replace(",", ".")) || 0;

      // Rooms
      let rooms = 0;
      const roomMatch = allText.match(/([\d.,]+)\s*(?:Zimmer|Zi\b)/i);
      if (roomMatch) rooms = parseFloat(roomMatch[1].replace(",", ".")) || 0;

      // Location
      const locEl = card.querySelector("[data-testid*='location'], [data-testid*='address']");
      const address = locEl?.textContent?.trim() || "";

      // Image
      const imgEl = card.querySelector("img[src*='willhaben'], img[src*='cache'], img[data-src]");
      const imgSrc = imgEl?.src || imgEl?.dataset?.src || "";
      const images = imgSrc && !imgSrc.includes("placeholder") && !imgSrc.includes("static/svg") ? [imgSrc] : [];

      const fullUrl = href.startsWith("http") ? href : (href ? "https://www.willhaben.at" + href : "");

      results.push({
        id: String(adId),
        title: title || address || "Listing " + adId,
        price,
        address,
        city: "",
        area,
        rooms,
        propertyType: "",
        images,
        latitude: 0,
        longitude: 0,
        detailUrl: fullUrl,
      });
    });

    return results;
  });
}

// ===== Extract detail from listing page =====
async function extractDetail(page, listing) {
  const url = listing.detailUrl || `https://www.willhaben.at/iad/object?adId=${listing.id}`;
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
    await sleep(2000);

    return await page.evaluate(() => {
      const detail = {
        images: [], description: "", area: 0, rooms: 0, floor: 0,
        totalFloors: 0, yearBuilt: 0, latitude: 0, longitude: 0,
        balcony: false, garden: false, cellar: false, elevator: false,
        condition: "", propertyType: "", price: 0,
      };

      // Helper to read attribute values
      function getAttr(attrs, name) {
        if (!attrs || !Array.isArray(attrs)) return "";
        for (const a of attrs) {
          const n = (a.name || a.attributeName || "").toUpperCase();
          if (n === name.toUpperCase()) {
            const v = a.values || a.value || [];
            return Array.isArray(v) ? (v[0] || "") : String(v);
          }
        }
        return "";
      }

      // -----------------------------------------------------------
      // Method 1: __NEXT_DATA__ on detail page
      // -----------------------------------------------------------
      try {
        const nextDataEl = document.getElementById("__NEXT_DATA__");
        if (nextDataEl) {
          const nd = JSON.parse(nextDataEl.textContent || "{}");
          const pageProps = nd.props?.pageProps || {};
          // Detail page data can be in various locations
          const adData = pageProps.advertDetailData || pageProps.adDetail || pageProps.ad ||
            pageProps.data?.advertDetailData || pageProps.data?.ad || {};

          const attrs = adData.attributes?.attribute || adData.attributes || adData.attributeList || [];

          detail.area = parseFloat(getAttr(attrs, "ESTATE_SIZE") || getAttr(attrs, "ESTATE_SIZE/LIVING_AREA") || getAttr(attrs, "LIVING_AREA") || "0") || 0;
          detail.rooms = parseFloat(getAttr(attrs, "NUMBER_OF_ROOMS") || getAttr(attrs, "ROOMS") || "0") || 0;
          detail.floor = parseInt(getAttr(attrs, "FLOOR") || getAttr(attrs, "ETAGE") || "0") || 0;
          detail.totalFloors = parseInt(getAttr(attrs, "NUMBER_OF_FLOORS") || getAttr(attrs, "TOTAL_FLOORS") || "0") || 0;
          detail.yearBuilt = parseInt(getAttr(attrs, "YEAR_BUILT") || getAttr(attrs, "YEAR_OF_CONSTRUCTION") || getAttr(attrs, "BAUART/BAUJAHR") || "0") || 0;
          detail.price = parseFloat(getAttr(attrs, "PRICE") || getAttr(attrs, "PRICE/FOR_SALE") || "0") || 0;
          detail.condition = getAttr(attrs, "CONDITION") || getAttr(attrs, "ZUSTAND") || "";
          detail.propertyType = getAttr(attrs, "PROPERTY_TYPE") || getAttr(attrs, "ESTATE_TYPE") || "";

          // Description / body text
          detail.description = (adData.description || adData.body || getAttr(attrs, "BODY") || getAttr(attrs, "DESCRIPTION") || "").slice(0, 2000);

          // Coordinates
          const coordAttr = (attrs || []).find(a => (a.name || "").toUpperCase() === "COORDINATES");
          if (coordAttr && Array.isArray(coordAttr.values) && coordAttr.values.length >= 2) {
            detail.latitude = parseFloat(coordAttr.values[0]) || 0;
            detail.longitude = parseFloat(coordAttr.values[1]) || 0;
          }
          // Also check top-level geo data
          if (!detail.latitude && adData.coordinates) {
            detail.latitude = parseFloat(adData.coordinates.latitude || adData.coordinates.lat || "0") || 0;
            detail.longitude = parseFloat(adData.coordinates.longitude || adData.coordinates.lng || "0") || 0;
          }

          // Images from the ad data
          const imgList = adData.advertImageList?.advertImage || adData.images || adData.imageList || [];
          for (const img of imgList) {
            const src = img.mainImageUrl || img.referenceImageUrl || img.url ||
              img.selfLink || (typeof img === "string" ? img : "");
            if (src && !src.includes("placeholder") && !src.includes("static/svg")) {
              // Use largest available size
              const fullSrc = src.replace(/\/\d+x\d+/, "/1200x900");
              detail.images.push(fullSrc);
            }
          }

          // Boolean features from attributes
          const allAttrNames = (attrs || []).map(a => (a.name || "").toUpperCase() + "=" + ((a.values || [])[0] || "").toUpperCase());
          const allAttrText = allAttrNames.join(" ");
          const freeText = (getAttr(attrs, "BODY") || getAttr(attrs, "FREE_TEXT") || detail.description || "").toLowerCase();

          if (allAttrText.includes("BALCONY") || allAttrText.includes("TERRASSE") || allAttrText.includes("LOGGIA") ||
              freeText.includes("balkon") || freeText.includes("terrasse") || freeText.includes("loggia")) {
            detail.balcony = true;
          }
          if (allAttrText.includes("GARDEN") || freeText.includes("garten")) {
            detail.garden = true;
          }
          if (allAttrText.includes("CELLAR") || allAttrText.includes("KELLER") ||
              freeText.includes("keller") || freeText.includes("kellerabteil")) {
            detail.cellar = true;
          }
          if (allAttrText.includes("ELEVATOR") || allAttrText.includes("LIFT") ||
              freeText.includes("aufzug") || freeText.includes("fahrstuhl") || freeText.includes("lift")) {
            detail.elevator = true;
          }

          if (detail.images.length > 0 || detail.area > 0 || detail.description) {
            return detail;
          }
        }
      } catch (e) {
        console.warn("Detail __NEXT_DATA__ parse error:", e.message);
      }

      // -----------------------------------------------------------
      // Method 2: JSON-LD on detail page
      // -----------------------------------------------------------
      try {
        const scripts = document.querySelectorAll("script[type='application/ld+json']");
        for (const s of scripts) {
          const data = JSON.parse(s.textContent || "");
          const dtype = data["@type"] || "";
          if (dtype === "Residence" || dtype === "Apartment" || dtype === "House" ||
              dtype === "SingleFamilyResidence" || dtype === "Product" || dtype === "RealEstateListing") {
            detail.area = parseFloat(data.floorSize?.value || "0") || detail.area;
            detail.rooms = parseInt(data.numberOfRooms || "0") || detail.rooms;
            detail.latitude = parseFloat(data.geo?.latitude || "0") || detail.latitude;
            detail.longitude = parseFloat(data.geo?.longitude || "0") || detail.longitude;
            if (data.image) {
              const imgs = Array.isArray(data.image) ? data.image : [data.image];
              if (imgs.length > 0 && detail.images.length === 0) detail.images = imgs;
            }
            detail.propertyType = dtype || detail.propertyType;
          }
        }
      } catch {}

      // -----------------------------------------------------------
      // Method 3: DOM scraping fallback
      // -----------------------------------------------------------

      // Gallery images from rendered DOM
      if (detail.images.length === 0) {
        const imgSelectors = [
          "[data-testid*='image-gallery'] img",
          "[data-testid*='gallery'] img",
          "[class*='gallery'] img",
          "[class*='slider'] img",
          "[class*='carousel'] img",
          "[class*='ImageGallery'] img",
          "[class*='Slideshow'] img",
          "picture source",
          "picture img",
        ];
        const imgEls = document.querySelectorAll(imgSelectors.join(", "));
        imgEls.forEach(img => {
          const src = img.srcset?.split(",")[0]?.trim()?.split(" ")[0] ||
            img.dataset?.src || img.src || "";
          if (src && !src.includes("placeholder") && !src.includes("avatar") &&
              !src.includes("static/svg") && !src.includes("logo") &&
              !detail.images.includes(src)) {
            detail.images.push(src);
          }
        });
      }

      // Description from rendered DOM
      if (!detail.description) {
        const descSelectors = [
          "[data-testid*='description']",
          "[data-testid*='body-content']",
          "[class*='description']",
          "[class*='Description']",
          "[class*='object-description']",
          "[class*='AdDescription']",
          "[class*='FreeText']",
        ];
        for (const sel of descSelectors) {
          const descEl = document.querySelector(sel);
          if (descEl && descEl.textContent.trim().length > 20) {
            detail.description = descEl.textContent.trim().slice(0, 2000);
            break;
          }
        }
      }

      // Attribute tables / definition lists from rendered DOM
      const dlEls = document.querySelectorAll("dl, [data-testid*='attribute'], table");
      dlEls.forEach(container => {
        // Try dt/dd pairs
        const dts = container.querySelectorAll("dt, th, [class*='label'], [class*='Label']");
        const dds = container.querySelectorAll("dd, td, [class*='value'], [class*='Value']");
        for (let i = 0; i < dts.length && i < dds.length; i++) {
          const label = (dts[i].textContent || "").trim().toLowerCase();
          const value = (dds[i].textContent || "").trim();
          if ((label.includes("wohnfl") || label.includes("nutzfl") || label.includes("fl\u00E4che")) && !detail.area) {
            detail.area = parseFloat(value.replace(/[^\d.,]/g, "").replace(",", ".")) || 0;
          }
          if ((label.includes("zimmer") || label.includes("r\u00E4ume")) && !detail.rooms) {
            detail.rooms = parseFloat(value.replace(",", ".")) || 0;
          }
          if (label.includes("stockwerk") || label.includes("etage") || label.includes("geschoss")) {
            if (!label.includes("gesamt") && !label.includes("anzahl")) {
              detail.floor = parseInt(value) || 0;
            } else {
              detail.totalFloors = parseInt(value) || 0;
            }
          }
          if (label.includes("baujahr") || label.includes("erricht")) {
            detail.yearBuilt = parseInt(value) || 0;
          }
          if (label.includes("zustand") || label.includes("condition")) {
            detail.condition = value;
          }
        }
      });

      // Area / rooms from page text if still missing
      const fullText = document.body?.textContent?.toLowerCase() || "";
      if (!detail.area) {
        const areaMatch = fullText.match(/([\d.,]+)\s*m\u00B2/);
        if (areaMatch) detail.area = parseFloat(areaMatch[1].replace(",", ".")) || 0;
      }
      if (!detail.rooms) {
        const roomMatch = fullText.match(/([\d.,]+)\s*zimmer/);
        if (roomMatch) detail.rooms = parseFloat(roomMatch[1].replace(",", ".")) || 0;
      }

      // Boolean features from page text
      if (fullText.includes("balkon") || fullText.includes("terrasse") || fullText.includes("loggia")) detail.balcony = true;
      if (fullText.includes("garten")) detail.garden = true;
      if (fullText.includes("keller") || fullText.includes("kellerabteil")) detail.cellar = true;
      if (fullText.includes("aufzug") || fullText.includes("fahrstuhl") || fullText.includes("lift")) detail.elevator = true;

      // GPS from embedded script data
      if (!detail.latitude) {
        const allScripts = document.querySelectorAll("script");
        for (const s of allScripts) {
          const txt = s.textContent || "";
          const latMatch = txt.match(/"latitude"\s*:\s*([\d.]+)/);
          const lngMatch = txt.match(/"longitude"\s*:\s*([\d.]+)/);
          if (latMatch && lngMatch) {
            detail.latitude = parseFloat(latMatch[1]) || 0;
            detail.longitude = parseFloat(lngMatch[1]) || 0;
            break;
          }
        }
      }

      return detail;
    });
  } catch (e) {
    console.error(`  Detail ${listing.id}: ${e.message}`);
    return null;
  }
}

// ===== Geocode city via Nominatim =====
const geocodeCache = {};
async function geocodeCity(cityName) {
  if (!cityName) return null;
  // Normalize: "Wien, 16. Bezirk, Ottakring" -> "Wien"
  const key = cityName.split(",")[0].trim();
  if (geocodeCache[key]) return geocodeCache[key];
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(key + ", Austria")}&format=json&limit=1`;
    const resp = await fetch(url, { headers: { "User-Agent": "Nemovizor/1.0" }, signal: AbortSignal.timeout(5000) });
    const data = await resp.json();
    if (data && data[0]) {
      const result = { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
      geocodeCache[key] = result;
      return result;
    }
  } catch {}
  return null;
}

// ===== Insert property =====
async function insertProperty(prop, search, r2Images) {
  const whId = String(prop.id);
  const slug = slugify(prop.title || prop.address || `immobilie-${whId}`) + `-wh${whId}`;

  const { data: dup } = await sb.from("properties").select("id").eq("slug", slug).maybeSingle();
  if (dup) return { skipped: true };

  const city = prop.city || search.city;
  const rooms = prop.rooms || 0;

  const property = {
    slug,
    title: prop.title || `Immobilie in ${city}`,
    listing_type: search.type,
    category: mapCategory(prop.propertyType || search.label),
    subtype: "ostatni",
    rooms_label: rooms > 0 ? `${rooms} Zi.` : "",
    price: prop.price || 0,
    price_currency: "eur",
    price_unit: search.type === "rent" ? "za_mesic" : undefined,
    city,
    district: prop.district || "",
    location_label: prop.address || city,
    latitude: prop.latitude || prop._geoLat || 0,
    longitude: prop.longitude || prop._geoLon || 0,
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
    source: "willhaben",
    country: "at",
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
  willhaben.at Scraper v2 (Playwright) | Pages: ${PAGES} | Delay: ${DELAY_MS}ms
  Searches: ${SEARCHES.map(s => s.label).join(", ")}
`);

  const state = loadState();
  const t0 = Date.now();

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: UA,
    viewport: { width: 1920, height: 1080 },
    locale: "de-AT",
    geolocation: { latitude: 48.2082, longitude: 16.3738 }, // Vienna
    permissions: ["geolocation"],
  });

  const page = await context.newPage();

  // Add console listener for debugging in-page warnings
  page.on("console", msg => {
    if (msg.type() === "warn" || msg.type() === "error") {
      const text = msg.text();
      if (text.includes("parse error") || text.includes("__NEXT_DATA__")) {
        console.log(`  [page] ${text}`);
      }
    }
  });

  console.log("  Opening willhaben.at...");
  await page.goto("https://www.willhaben.at", { waitUntil: "domcontentloaded", timeout: 30000 });
  await sleep(3000);

  // Accept cookies
  try {
    const cookieBtn = page.locator("button:has-text('Alle akzeptieren'), button:has-text('Alle Akzeptieren'), button:has-text('Accept All'), button:has-text('Zustimmen'), [data-testid='consent-accept-all'], #didomi-notice-agree-button");
    if (await cookieBtn.isVisible({ timeout: 5000 })) {
      await cookieBtn.click();
      console.log("  Cookies accepted");
      await sleep(1000);
    }
  } catch {}

  // Check if we can access the site
  const testTitle = await page.title();
  console.log(`  Page title: ${testTitle}`);
  if (testTitle.includes("blocked") || testTitle.includes("Access Denied")) {
    console.error("  BLOCKED: Site is blocking headless browser. Try VPN.");
    await browser.close();
    process.exit(1);
  }

  for (const search of SEARCHES) {
    console.log(`\n== ${search.label} ==`);

    for (let p = 1; p <= PAGES; p++) {
      const pageUrl = p === 1 ? search.url : `${search.url}?page=${p}`;

      await sleep(DELAY_MS);
      try {
        await page.goto(pageUrl, { waitUntil: "domcontentloaded", timeout: 25000 });
        await sleep(3000);

        // Wait for content to render -- look for the __NEXT_DATA__ script
        // or any search result entries
        try {
          await page.waitForSelector("#__NEXT_DATA__, [data-testid='search-result-entry'], [data-testid='ad-list-item'], a[href*='/iad/immobilien/d/']", { timeout: 8000 });
        } catch {
          // Page may still have data, continue
        }

        // Check for CAPTCHA
        const hasCaptcha = await page.locator("#captcha, [class*='captcha'], [class*='Captcha']").isVisible({ timeout: 2000 }).catch(() => false);
        if (hasCaptcha) {
          console.log("  CAPTCHA detected, waiting 30s...");
          await sleep(30000);
        }
      } catch (e) {
        console.error(`  Nav error: ${e.message}`);
        continue;
      }

      // Debug: log what data sources are available on the page
      if (p === 1) {
        const debugInfo = await page.evaluate(() => {
          const info = {};
          info.hasNextData = !!document.getElementById("__NEXT_DATA__");
          info.hasJsonLd = document.querySelectorAll("script[type='application/ld+json']").length;
          info.hasWhGlobal = !!(window.__wh__ || window.__INITIAL_STATE__);
          info.linksToDetail = document.querySelectorAll("a[href*='/iad/immobilien/d/']").length;
          info.searchResultEntries = document.querySelectorAll("[data-testid='search-result-entry']").length;
          info.adListItems = document.querySelectorAll("[data-testid='ad-list-item']").length;
          info.articles = document.querySelectorAll("article").length;
          // Try to peek at __NEXT_DATA__ structure
          if (info.hasNextData) {
            try {
              const nd = JSON.parse(document.getElementById("__NEXT_DATA__").textContent || "{}");
              const pp = nd.props?.pageProps || {};
              info.pagePropsKeys = Object.keys(pp).slice(0, 10);
              const sr = pp.searchResult || pp.searchResults || pp.data?.searchResult || {};
              info.searchResultKeys = Object.keys(sr).slice(0, 10);
              if (sr.advertSummaryList) {
                info.advertCount = (sr.advertSummaryList.advertSummary || []).length;
                const firstAd = (sr.advertSummaryList.advertSummary || [])[0];
                if (firstAd) {
                  info.firstAdKeys = Object.keys(firstAd).slice(0, 15);
                  info.firstAdId = firstAd.id || firstAd.adId || "none";
                  info.firstAdAttrSample = (firstAd.attributes?.attribute || []).slice(0, 5).map(a => a.name || "?");
                }
              } else if (sr.resultList) {
                info.resultListCount = sr.resultList.length;
              }
            } catch (e) { info.nextDataError = e.message; }
          }
          return info;
        });
        console.log(`  Debug info:`, JSON.stringify(debugInfo, null, 2));
      }

      const listings = await extractListings(page);
      if (listings.length === 0) { console.log(`  Page ${p}: empty, next`); break; }

      console.log(`  Page ${p}: ${listings.length} listings`);

      // Log first listing for debugging
      if (p === 1 && listings.length > 0) {
        const first = listings[0];
        console.log(`  Sample: id=${first.id}, title=${(first.title || "").slice(0, 50)}, price=${first.price}, area=${first.area}, rooms=${first.rooms}, url=${(first.detailUrl || "").slice(0, 80)}, imgs=${first.images.length}`);
      }

      for (const prop of listings) {
        const whId = String(prop.id);
        if (!whId || state.seen[`wh-${whId}`]) { process.stdout.write("s"); continue; }

        try {
          // Detail page
          const detail = await extractDetail(page, prop);
          if (detail) {
            if (detail.images.length > 0) prop.images = detail.images;
            if (detail.latitude) prop.latitude = detail.latitude;
            if (detail.longitude) prop.longitude = detail.longitude;
            if (detail.area) prop.area = detail.area;
            if (detail.rooms) prop.rooms = detail.rooms;
            if (detail.price && !prop.price) prop.price = detail.price;
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
            if (!imgUrl || imgUrl.startsWith("data:") || imgUrl.includes("placeholder") || imgUrl.includes("static/svg")) continue;
            const url = await uploadToR2(imgUrl, slugify(prop.title || whId));
            if (url) { r2Urls.push(url); state.stats.images++; }
          }

          // Geocode fallback if no longitude
          if (!prop.longitude && (prop.city || prop.address)) {
            const geo = await geocodeCity(prop.city || prop.address);
            if (geo) { prop._geoLat = geo.lat; prop._geoLon = geo.lon; }
          }

          const res = await insertProperty(prop, search, r2Urls);
          if (res.skipped) { state.stats.skipped++; process.stdout.write("d"); }
          else { state.stats.properties++; process.stdout.write("."); }

          state.seen[`wh-${whId}`] = true;
          if (state.stats.properties % 5 === 0) saveState(state);
        } catch (e) {
          state.stats.errors++;
          console.error(`\n  Err ${whId}: ${e.message}`);
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
