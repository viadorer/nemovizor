#!/usr/bin/env node
// ============================================================
// Immobiliare.it Scraper v3 -- Playwright edition
// Italian Real Estate -- headless browser bypasses geo-blocking
// Primary extraction: __NEXT_DATA__ JSON (Next.js SSR payload)
// Fallback: JSON-LD structured data, then DOM scraping
// Usage: node scripts/scrape-immobiliare.mjs [--pages 5] [--delay 3000]
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
if (!r2) console.warn("WARNING: R2 not configured -- images skipped");

// ===== State =====
const STATE_FILE = resolve(ROOT, "scripts/.scrape-state-immobiliare.json");
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

// ===== Category mapping (Italian) =====
function mapCategory(type) {
  if (!type) return "apartment";
  const t = type.toLowerCase();
  if (t.includes("appartamento") || t.includes("apartment") || t.includes("attico") || t.includes("loft") || t.includes("mansarda") || t.includes("monolocale") || t.includes("bilocale") || t.includes("trilocale")) return "apartment";
  if (t.includes("casa") || t.includes("villa") || t.includes("villetta") || t.includes("casale") || t.includes("rustico") || t.includes("house") || t.includes("bifamiliare") || t.includes("trifamiliare") || t.includes("indipendente")) return "house";
  if (t.includes("terreno") || t.includes("land") || t.includes("agricolo")) return "land";
  if (t.includes("ufficio") || t.includes("negozio") || t.includes("commercial") || t.includes("locale") || t.includes("capannone") || t.includes("magazzino") || t.includes("laboratorio")) return "commercial";
  return "other";
}

// ===== Searches =====
const SEARCHES = [
  { url: "https://www.immobiliare.it/vendita-case/roma/", city: "Roma", type: "sale", label: "Roma Vendita" },
  { url: "https://www.immobiliare.it/affitto-case/roma/", city: "Roma", type: "rent", label: "Roma Affitto" },
  { url: "https://www.immobiliare.it/vendita-case/milano/", city: "Milano", type: "sale", label: "Milano Vendita" },
  { url: "https://www.immobiliare.it/affitto-case/milano/", city: "Milano", type: "rent", label: "Milano Affitto" },
  { url: "https://www.immobiliare.it/vendita-case/firenze/", city: "Firenze", type: "sale", label: "Firenze Vendita" },
  { url: "https://www.immobiliare.it/vendita-case/napoli/", city: "Napoli", type: "sale", label: "Napoli Vendita" },
  { url: "https://www.immobiliare.it/vendita-case/torino/", city: "Torino", type: "sale", label: "Torino Vendita" },
  { url: "https://www.immobiliare.it/vendita-case/venezia/", city: "Venezia", type: "sale", label: "Venezia Vendita" },
];

// ===== Stealth: init script to hide automation signals =====
const STEALTH_SCRIPT = `
  // Remove webdriver flag
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined });

  // Override plugins to look like a real browser
  Object.defineProperty(navigator, 'plugins', {
    get: () => {
      const arr = [
        { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
        { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
        { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' },
      ];
      arr.length = 3;
      return arr;
    }
  });

  // Override languages
  Object.defineProperty(navigator, 'languages', { get: () => ['it-IT', 'it', 'en-US', 'en'] });

  // Override permissions query to avoid detection
  const origQuery = window.Permissions?.prototype?.query;
  if (origQuery) {
    window.Permissions.prototype.query = (params) => {
      if (params?.name === 'notifications') {
        return Promise.resolve({ state: Notification.permission });
      }
      return origQuery.call(window.Permissions.prototype, params);
    };
  }

  // Chrome runtime object (present in real Chrome)
  if (!window.chrome) {
    window.chrome = {};
  }
  if (!window.chrome.runtime) {
    window.chrome.runtime = {
      connect: () => {},
      sendMessage: () => {},
    };
  }

  // Override the getter for connection.rtt to return a realistic value
  if (navigator.connection) {
    Object.defineProperty(navigator.connection, 'rtt', { get: () => 50 });
  }
`;

// ===== Accept cookie consent (multiple strategies) =====
async function acceptCookieConsent(page) {
  console.log("  Attempting cookie consent acceptance...");

  // Strategy 1: Use Didomi API directly (immobiliare.it uses Didomi CMP)
  try {
    const didomiResult = await page.evaluate(() => {
      if (typeof Didomi !== "undefined" && Didomi.setUserAgreeToAll) {
        Didomi.setUserAgreeToAll();
        return "didomi-api";
      }
      return null;
    });
    if (didomiResult) {
      console.log("  Cookies accepted via Didomi API");
      await sleep(1000);
      return true;
    }
  } catch {}

  // Strategy 2: Click the Didomi agree button by ID
  try {
    const didomiBtn = page.locator("#didomi-notice-agree-button");
    if (await didomiBtn.isVisible({ timeout: 3000 })) {
      await didomiBtn.click();
      console.log("  Cookies accepted via Didomi button");
      await sleep(1000);
      return true;
    }
  } catch {}

  // Strategy 3: Try various common consent button selectors
  const consentSelectors = [
    "button[id*='didomi'][id*='agree']",
    "button[id*='accept']",
    "button[class*='didomi'][class*='agree']",
    "button:has-text('Accetta tutti')",
    "button:has-text('Accetta')",
    "button:has-text('Accetto')",
    "button:has-text('Accept All')",
    "button:has-text('Accept')",
    "[class*='consent'] button:has-text('Accetta')",
    "[class*='consent'] button:has-text('Accept')",
    "[class*='cookie'] button:has-text('Accetta')",
    "[class*='cookie'] button:has-text('Accept')",
    "a:has-text('Accetta tutti')",
    "a:has-text('Accetta')",
  ];

  for (const sel of consentSelectors) {
    try {
      const btn = page.locator(sel).first();
      if (await btn.isVisible({ timeout: 1500 })) {
        await btn.click();
        console.log(`  Cookies accepted via: ${sel}`);
        await sleep(1000);
        return true;
      }
    } catch {}
  }

  // Strategy 4: Look inside iframes for consent buttons
  try {
    const frames = page.frames();
    for (const frame of frames) {
      const frameUrl = frame.url();
      if (frameUrl.includes("consent") || frameUrl.includes("didomi") || frameUrl.includes("cookie") || frameUrl.includes("privacy")) {
        for (const sel of ["button:has-text('Accetta')", "button:has-text('Accept')", "button[id*='agree']", "button[id*='accept']"]) {
          try {
            const btn = frame.locator(sel).first();
            if (await btn.isVisible({ timeout: 1500 })) {
              await btn.click();
              console.log(`  Cookies accepted via iframe: ${sel}`);
              await sleep(1000);
              return true;
            }
          } catch {}
        }
      }
    }
  } catch {}

  // Strategy 5: Set Didomi consent cookies directly
  try {
    await page.context().addCookies([
      {
        name: "didomi_token",
        value: "eyJ1c2VyX2lkIjoiMTkzNTRhZDAtMDAwMC0wMDAwLTAwMDAtMDAwMDAwMDAwMDAwIiwiY3JlYXRlZCI6IjIwMjUtMDEtMDFUMDA6MDA6MDAuMDAwWiIsInVwZGF0ZWQiOiIyMDI1LTAxLTAxVDAwOjAwOjAwLjAwMFoiLCJ2ZXJzaW9uIjoyLCJwdXJwb3NlcyI6eyJlbmFibGVkIjpbImNvb2tpZXMiLCJhZHZlcnRpc2luZ19wZXJzb25hbGl6YXRpb24iLCJjb250ZW50X3BlcnNvbmFsaXphdGlvbiIsImFkX2RlbGl2ZXJ5IiwiYW5hbHl0aWNzIl19LCJ2ZW5kb3JzIjp7ImVuYWJsZWQiOlsiZ29vZ2xlIiwiYzppbW1vYmlsaWFyZSJdfX0=",
        domain: ".immobiliare.it",
        path: "/",
        httpOnly: false,
        secure: false,
        sameSite: "Lax",
      },
      {
        name: "euconsent-v2",
        // This is a TC string indicating full consent -- may need updating
        // but having any value often bypasses the consent wall
        value: "CQHzEAAQHzEAAAHABBITBRFgAPAAAH_gAAAAAAAAAA2gBwAOAAeABIADMAHgAQAAigBSAC4AGMAZgA0AB2AEEAIgASwApABdADQAHIAP4AhIBFgCOAE2AJ4AUwAtABhgDRAG0ANwAcgA6gB7AEKAIiASYAmwBRgCogFkALiAX4AxABkgDOAGiANoAbwA4gB0gDuAH2AQIAhYBFgCOgEdAJcATIAnQBTwCwAF5AMUAZIAy4BogDcAHIAPUAe4A_ACGAE0AJ4AXIAxQBvgDzAH6ASIApABbADDAGYAN4AfQBEACOAFcALMAbIA6QB9gEOAIqAR4AowBUQCxAF5ALyAYQAxYBpADcgHCAOqAfMBAoCGQENAIiASoAtgBegDIgGhANIAdgA74CIgEzAJuAUEArQBawC9AGOAMmAbgA4oBywD4gH1AQOAhcBH4CUQEtAJ0AUQAqsBYAC8gGKAN-AegA_IB_QEHgIiAR4Aj4BLoCbAE_AKEAUeAtABagDFAGaANEAc0A6QB7gD8gIDAQYAiYBKgCpgFZALYAXkAwABkgDRAG0AOIAf4BAgCNAEfgJNATYAoIBSQCxAGGAM0AbYA5ACIAEdAJkAUYAo4BWACzAGSANuAb4A8wCHAEfAJUASwAqABYcDBAGKAN-AfUBA4CHAEaAJUAWwAvIBigDfgH5AQ-AikBLQCdAFEAKrAWAAu4BjADcgHVAPKAgMBDICGgERgJNATIApABdwDEAGXANIAdkA74CCAERAJmAT0AoIBWgC1gF6ANkAbkA4IBxQDlgHxAP8Ag4BHoCUQEtAKIAUcAqsBYAC8gGPAMsAbcA3wB5gEOAI-ATQA",
        domain: ".immobiliare.it",
        path: "/",
        httpOnly: false,
        secure: false,
        sameSite: "Lax",
      },
    ]);
    console.log("  Set consent cookies directly as fallback");
    return true;
  } catch (e) {
    console.log(`  Failed to set consent cookies: ${e.message}`);
  }

  return false;
}

// ===== Navigate with retry and consent handling =====
async function navigateWithRetry(page, url, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
      // Give the page time to hydrate (Next.js SPA)
      await sleep(3000);

      // Check if the page actually loaded content
      const bodyLen = await page.evaluate(() => (document.body?.textContent || "").length);

      if (bodyLen < 1000) {
        console.log(`  Page body too small (${bodyLen} chars), attempt ${attempt}/${maxRetries}`);

        // Might be a consent wall -- try accepting again
        await acceptCookieConsent(page);
        await sleep(2000);

        // Re-check body length after consent
        const bodyLen2 = await page.evaluate(() => (document.body?.textContent || "").length);
        if (bodyLen2 > 1000) {
          console.log(`  Content loaded after consent (${bodyLen2} chars)`);
          return true;
        }

        // Try reloading after consent acceptance
        if (attempt < maxRetries) {
          console.log("  Reloading page after consent...");
          await page.reload({ waitUntil: "domcontentloaded", timeout: 30000 });
          await sleep(3000);

          const bodyLen3 = await page.evaluate(() => (document.body?.textContent || "").length);
          if (bodyLen3 > 1000) {
            console.log(`  Content loaded after reload (${bodyLen3} chars)`);
            return true;
          }
        }
      } else {
        return true;
      }
    } catch (e) {
      console.log(`  Navigation attempt ${attempt} failed: ${e.message}`);
      if (attempt === maxRetries) return false;
      await sleep(2000);
    }
  }
  return false;
}

// ===== Extract listings from search page =====
async function extractListings(page) {
  return await page.evaluate(() => {
    const results = [];

    // ------------------------------------------------------------------
    // Method 1 (primary): __NEXT_DATA__ JSON embedded by Next.js
    // immobiliare.it is a Next.js app; the search results are serialised
    // inside a <script id="__NEXT_DATA__"> tag as part of pageProps.
    // ------------------------------------------------------------------
    try {
      const ndScript = document.getElementById("__NEXT_DATA__");
      if (ndScript) {
        const nd = JSON.parse(ndScript.textContent || "{}");
        // The results typically live at pageProps.dehydratedState or
        // pageProps.searchResults or pageProps.results -- walk common paths
        const pp = nd?.props?.pageProps || {};

        // Attempt several known locations where listings appear
        let rawResults =
          pp.results ||
          pp.searchResults?.results ||
          pp.searchResults ||
          pp.listings ||
          pp.list ||
          null;

        // dehydratedState path (React Query cache)
        if (!rawResults && pp.dehydratedState?.queries) {
          for (const q of pp.dehydratedState.queries) {
            const d = q?.state?.data;
            if (d?.results && Array.isArray(d.results)) {
              rawResults = d.results;
              break;
            }
            if (d?.list && Array.isArray(d.list)) {
              rawResults = d.list;
              break;
            }
            // Sometimes the data is paginated
            if (d?.pages) {
              for (const pg of d.pages) {
                if (pg?.results && Array.isArray(pg.results)) {
                  rawResults = pg.results;
                  break;
                }
              }
              if (rawResults) break;
            }
          }
        }

        // Also try the top-level initialReduxState or initialState
        if (!rawResults) {
          const redux = nd?.props?.initialReduxState || nd?.props?.initialState || {};
          rawResults =
            redux?.search?.results ||
            redux?.listing?.results ||
            redux?.results ||
            null;
        }

        if (Array.isArray(rawResults)) {
          for (const r of rawResults) {
            // Each result object has an id (numeric), a realEstate or
            // property sub-object with the actual data.
            const re = r.realEstate || r.property || r;
            const id = String(re.id || r.id || "");
            if (!id) continue;

            const price =
              re.price?.value ||
              re.prices?.price ||
              re.price?.main?.value ||
              (typeof re.price === "number" ? re.price : 0) ||
              0;

            const title = re.title || re.subject || r.title || "";
            const address =
              re.location?.address ||
              re.address ||
              re.location?.title ||
              "";
            const city =
              re.location?.city?.name ||
              re.location?.city ||
              re.city ||
              "";
            const area =
              re.surface ||
              re.surfaceValue ||
              re.properties?.surface ||
              re.size ||
              0;
            const rooms =
              re.rooms ||
              re.properties?.rooms ||
              re.features?.rooms ||
              0;
            const bathrooms =
              re.bathrooms ||
              re.properties?.bathrooms ||
              re.features?.bathrooms ||
              0;

            // Geo
            const lat =
              re.location?.latitude ||
              re.location?.coordinate?.latitude ||
              re.latitude ||
              0;
            const lng =
              re.location?.longitude ||
              re.location?.coordinate?.longitude ||
              re.longitude ||
              0;

            // Images -- usually an array of objects with urls or a single url
            const rawImgs = re.multimedia?.photos || re.photos || re.images || re.multimedia?.images || [];
            const images = [];
            for (const img of (Array.isArray(rawImgs) ? rawImgs : [])) {
              const src =
                (typeof img === "string") ? img :
                img.urls?.large || img.urls?.medium || img.urls?.small ||
                img.url || img.uri || img.src || "";
              if (src && !src.includes("placeholder") && !src.includes("data:")) {
                images.push(src);
              }
            }

            // Build the detail URL
            const detailUrl = re.urls?.detail || re.url || r.seo?.url || r.url || "";
            const fullDetailUrl = detailUrl.startsWith("http")
              ? detailUrl
              : detailUrl
                ? `https://www.immobiliare.it${detailUrl.startsWith("/") ? "" : "/"}${detailUrl}`
                : `https://www.immobiliare.it/annunci/${id}/`;

            const propertyType =
              re.typology?.name || re.category?.name || re.type || re.typologyV2?.name || "";

            results.push({
              id,
              title: title || address || `Immobile ${id}`,
              price: Number(String(price).replace(/[^0-9]/g, "")) || 0,
              address,
              city,
              area: parseFloat(String(area).replace(",", ".")) || 0,
              rooms: parseInt(String(rooms)) || 0,
              bathrooms: parseInt(String(bathrooms)) || 0,
              propertyType,
              images,
              latitude: parseFloat(String(lat)) || 0,
              longitude: parseFloat(String(lng)) || 0,
              detailUrl: fullDetailUrl,
            });
          }
        }
      }
    } catch (e) {
      // __NEXT_DATA__ parsing failed, continue to fallback methods
    }

    if (results.length > 0) return results;

    // ------------------------------------------------------------------
    // Method 2: JSON-LD structured data
    // Search pages may have an ItemList with basic listing info.
    // ------------------------------------------------------------------
    const scripts = document.querySelectorAll("script[type='application/ld+json']");
    for (const s of scripts) {
      try {
        const data = JSON.parse(s.textContent || "");
        // Handle both top-level and @graph wrapped ItemList
        const lists = [];
        if (data["@type"] === "ItemList") lists.push(data);
        if (Array.isArray(data["@graph"])) {
          for (const node of data["@graph"]) {
            if (node["@type"] === "ItemList") lists.push(node);
          }
        }
        for (const list of lists) {
          if (!list.itemListElement) continue;
          for (const item of list.itemListElement) {
            const offer = item.item || item;
            const url = offer.url || offer["@id"] || "";
            const idMatch = url.match(/\/(\d+)\/?/);
            const id = idMatch ? idMatch[1] : "";
            if (!id) continue;
            results.push({
              id: String(id),
              title: offer.name || "",
              price: Number(String(offer.offers?.price || offer.offers?.lowPrice || "0").replace(/[^0-9]/g, "")) || 0,
              address: offer.address?.streetAddress || offer.address?.addressLocality || "",
              city: offer.address?.addressLocality || "",
              area: parseFloat(offer.floorSize?.value || "0") || 0,
              rooms: parseInt(offer.numberOfRooms || "0") || 0,
              bathrooms: 0,
              propertyType: offer["@type"] || "",
              images: offer.image ? (Array.isArray(offer.image) ? offer.image : [offer.image]) : [],
              latitude: parseFloat(offer.geo?.latitude || "0") || 0,
              longitude: parseFloat(offer.geo?.longitude || "0") || 0,
              detailUrl: url.startsWith("http") ? url : `https://www.immobiliare.it${url}`,
            });
          }
        }
      } catch {}
    }

    if (results.length > 0) return results;

    // ------------------------------------------------------------------
    // Method 3: DOM scraping with known immobiliare.it selectors
    // The site uses BEM-style class names with "in-" and "nd-" prefixes.
    // Listing cards are <li> elements inside the search results list.
    // ------------------------------------------------------------------
    const cardSelectors = [
      "li.nd-list__item.in-realEstateResults__item",
      "li[class*='in-realEstateResults']",
      "li[class*='RealEstateListItem']",
      "div[class*='in-listingCardPropertyCardAlt']",
      "div[class*='in-realEstateListCard']",
      "article[class*='listing-item']",
      "div[class*='listing-item']",
      // Generic fallback: any list item containing a link to /annunci/
      "li:has(a[href*='/annunci/'])",
    ];

    let cards = [];
    for (const sel of cardSelectors) {
      try {
        cards = document.querySelectorAll(sel);
        if (cards.length > 0) break;
      } catch {}
    }

    cards.forEach(el => {
      // Find the detail link -- always contains /annunci/ and a numeric ID
      const linkEl =
        el.querySelector("a[href*='/annunci/']") ||
        el.querySelector("a[href*='/vendita-case/']") ||
        el.querySelector("a[href*='/affitto-case/']") ||
        el.querySelector("a[href]");
      const href = linkEl?.href || "";
      const idMatch = href.match(/\/(\d+)\/?(?:\?|#|$)/);
      const id = idMatch?.[1] || "";
      if (!id) return;

      // Title -- multiple possible selectors
      const titleEl =
        el.querySelector("a[class*='in-card__title'], a[class*='in-listingCardTitle'], [class*='in-realEstateListCard__title']") ||
        el.querySelector("[class*='nd-mediaObject__title'], [class*='card-title']") ||
        el.querySelector("p.nd-mediaObject__title") ||
        el.querySelector("a.nd-mediaObject__title") ||
        el.querySelector("h2, h3, [class*='title'], [class*='Title']");
      const title = titleEl?.textContent?.trim() || "";

      // Price
      const priceEl =
        el.querySelector("[class*='in-listingCardPrice'], [class*='in-realEstateListCard__price']") ||
        el.querySelector("[class*='nd-mediaObject__price']") ||
        el.querySelector("li[class*='lif__pricing']") ||
        el.querySelector("[class*='price'], [class*='Price']");
      const priceText = priceEl?.textContent?.trim() || "0";
      const price = Number(priceText.replace(/[^0-9]/g, "")) || 0;

      // Address / location
      const addressEl =
        el.querySelector("[class*='in-listingCardAddress'], [class*='in-realEstateListCard__address']") ||
        el.querySelector("[class*='nd-mediaObject__address']") ||
        el.querySelector("[class*='address'], [class*='Address'], [class*='location']");
      const address = addressEl?.textContent?.trim() || "";

      // Features: rooms, area, bathrooms from feature list items
      let area = 0;
      let rooms = 0;
      let bathrooms = 0;

      // Feature items use classes like lif__item, in-realEstateListCard__features,
      // nd-list__item inside the card, or in-feat
      const featureEls = el.querySelectorAll(
        "li.lif__item, [class*='in-listingCardFeatureList'] li, " +
        "[class*='in-realEstateListCard__feature'] li, " +
        "[class*='nd-list__item'], [class*='in-feat'], " +
        "[class*='feature'] li, [class*='Feature'] li, " +
        "span[class*='rooms'], span[class*='surface']"
      );
      featureEls.forEach(feat => {
        const text = feat.textContent?.trim()?.toLowerCase() || "";
        const ariaLabel = (feat.getAttribute("aria-label") || "").toLowerCase();
        const combined = text + " " + ariaLabel;

        if (combined.includes("m\u00B2") || combined.includes("mq") || combined.includes("superficie")) {
          area = parseFloat(text.replace(/[^0-9.,]/g, "").replace(",", ".")) || 0;
        }
        if (combined.includes("local") || combined.includes("stanz") || combined.includes("vani")) {
          rooms = parseInt(text.replace(/[^0-9]/g, "")) || 0;
        }
        if (combined.includes("bagn")) {
          bathrooms = parseInt(text.replace(/[^0-9]/g, "")) || 0;
        }
      });

      // Also try to get features from data attributes or tooltip text
      const featureContainer = el.querySelector("[class*='features'], [class*='Features']");
      if (featureContainer && !area && !rooms) {
        const allText = featureContainer.textContent?.toLowerCase() || "";
        const areaMatch = allText.match(/([\d.,]+)\s*m/);
        if (areaMatch) area = parseFloat(areaMatch[1].replace(",", ".")) || 0;
        const roomsMatch = allText.match(/(\d+)\s*(?:local|stanz|vani)/);
        if (roomsMatch) rooms = parseInt(roomsMatch[1]) || 0;
        const bathMatch = allText.match(/(\d+)\s*bagn/);
        if (bathMatch) bathrooms = parseInt(bathMatch[1]) || 0;
      }

      // Image
      const imgEl = el.querySelector("img[src*='pwm.im'], img[src*='immobiliare'], img[data-src], img[src]");
      const imgSrc = imgEl?.dataset?.src || imgEl?.src || "";

      results.push({
        id: String(id),
        title: title || address || `Immobile ${id}`,
        price,
        address,
        city: "",
        area,
        rooms,
        bathrooms,
        propertyType: "",
        images: imgSrc && !imgSrc.includes("placeholder") && !imgSrc.includes("data:") ? [imgSrc] : [],
        latitude: 0,
        longitude: 0,
        detailUrl: href,
      });
    });

    return results;
  });
}

// ===== Extract detail from listing page =====
async function extractDetail(page, listingId, detailUrl) {
  const url = detailUrl || `https://www.immobiliare.it/annunci/${listingId}/`;
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
    await sleep(2000);

    return await page.evaluate(() => {
      const detail = {
        images: [], description: "", area: 0, rooms: 0, floor: 0,
        totalFloors: 0, yearBuilt: 0, bathrooms: 0, latitude: 0,
        longitude: 0, balcony: false, garden: false, cellar: false,
        elevator: false, condition: "", propertyType: "",
      };

      // ----------------------------------------------------------------
      // Method 1 (primary): __NEXT_DATA__ on the detail page
      // ----------------------------------------------------------------
      try {
        const ndScript = document.getElementById("__NEXT_DATA__");
        if (ndScript) {
          const nd = JSON.parse(ndScript.textContent || "{}");
          const pp = nd?.props?.pageProps || {};

          // The listing object may live at different paths
          const re =
            pp.listing || pp.realEstate || pp.property || pp.detail ||
            pp.listingDetail || pp.adDetail || null;

          // Also check dehydratedState queries
          let reFromQuery = null;
          if (!re && pp.dehydratedState?.queries) {
            for (const q of pp.dehydratedState.queries) {
              const d = q?.state?.data;
              if (d && (d.id || d.realEstate || d.listing)) {
                reFromQuery = d.realEstate || d.listing || d;
                break;
              }
            }
          }

          const item = re || reFromQuery;
          if (item) {
            detail.area =
              parseFloat(String(item.surface || item.surfaceValue || item.properties?.surface || item.size || "0").replace(",", ".")) || 0;
            detail.rooms =
              parseInt(String(item.rooms || item.properties?.rooms || item.features?.rooms || "0")) || 0;
            detail.bathrooms =
              parseInt(String(item.bathrooms || item.properties?.bathrooms || item.features?.bathrooms || "0")) || 0;
            detail.floor =
              parseInt(String(item.floor?.value || item.floor || item.properties?.floor || "0")) || 0;
            detail.totalFloors =
              parseInt(String(item.building?.floors || item.buildingFloors || item.properties?.totalFloors || "0")) || 0;
            detail.yearBuilt =
              parseInt(String(item.building?.yearOfConstruction || item.yearBuilt || item.properties?.yearBuilt || "0")) || 0;
            detail.condition =
              item.condition || item.properties?.condition || "";
            detail.propertyType =
              item.typology?.name || item.category?.name || item.type ||
              item.typologyV2?.name || item.properties?.typology || "";

            // Geo
            detail.latitude =
              parseFloat(String(item.location?.latitude || item.location?.coordinate?.latitude || item.latitude || "0")) || 0;
            detail.longitude =
              parseFloat(String(item.location?.longitude || item.location?.coordinate?.longitude || item.longitude || "0")) || 0;

            // Images
            const rawImgs =
              item.multimedia?.photos || item.photos || item.images ||
              item.multimedia?.images || item.gallery || [];
            for (const img of (Array.isArray(rawImgs) ? rawImgs : [])) {
              const src =
                (typeof img === "string") ? img :
                img.urls?.large || img.urls?.medium || img.urls?.small ||
                img.url || img.uri || img.src || "";
              if (src && !src.includes("placeholder") && !src.includes("data:")) {
                detail.images.push(src);
              }
            }

            // Description
            detail.description =
              (item.description || item.properties?.description || "").slice(0, 2000);

            // Boolean features from structured data
            const featureList = item.features || item.properties?.features || item.amenities || [];
            const featureNames = Array.isArray(featureList)
              ? featureList.map(f => (typeof f === "string" ? f : f.name || f.label || "").toLowerCase())
              : [];
            const featureText = featureNames.join(" ");

            detail.balcony = featureText.includes("balcon") ||
              !!(item.balcony || item.hasBalcony || item.properties?.balcony);
            detail.garden = featureText.includes("giardin") || featureText.includes("garden") ||
              !!(item.garden || item.hasGarden || item.properties?.garden);
            detail.cellar = featureText.includes("cantin") || featureText.includes("seminterrato") ||
              !!(item.cellar || item.properties?.cellar);
            detail.elevator = featureText.includes("ascensor") || featureText.includes("elevator") ||
              !!(item.elevator || item.hasElevator || item.lift || item.properties?.elevator);
          }
        }
      } catch (e) {
        // __NEXT_DATA__ parsing failed, continue to fallback
      }

      // If we got good data from __NEXT_DATA__, return early
      if (detail.images.length > 0 || detail.area > 0 || detail.rooms > 0) {
        return detail;
      }

      // ----------------------------------------------------------------
      // Method 2: JSON-LD on detail page
      // ----------------------------------------------------------------
      const scripts = document.querySelectorAll("script[type='application/ld+json']");
      for (const s of scripts) {
        try {
          const data = JSON.parse(s.textContent || "");
          // Look for property-related types in top level or @graph
          const candidates = [];
          if (data["@type"]) candidates.push(data);
          if (Array.isArray(data["@graph"])) candidates.push(...data["@graph"]);

          for (const item of candidates) {
            const t = item["@type"] || "";
            if (!t.match(/Residence|Apartment|House|SingleFamily|Product|RealEstate|Place|LodgingBusiness/i)) continue;

            detail.area = parseFloat(item.floorSize?.value || "0") || detail.area;
            detail.rooms = parseInt(item.numberOfRooms || "0") || detail.rooms;
            detail.latitude = parseFloat(item.geo?.latitude || "0") || detail.latitude;
            detail.longitude = parseFloat(item.geo?.longitude || "0") || detail.longitude;
            detail.propertyType = detail.propertyType || t;
            detail.description = detail.description || (item.description || "").slice(0, 2000);

            const imgs = item.image || item.photo;
            if (imgs && detail.images.length === 0) {
              const imgArr = Array.isArray(imgs) ? imgs : [imgs];
              for (const img of imgArr) {
                const src = typeof img === "string" ? img : (img.contentUrl || img.url || "");
                if (src) detail.images.push(src);
              }
            }
          }
        } catch {}
      }

      if (detail.images.length > 0 || detail.area > 0) return detail;

      // ----------------------------------------------------------------
      // Method 3: DOM scraping with immobiliare.it-specific selectors
      // ----------------------------------------------------------------

      // Gallery images -- immobiliare.it uses nd-slideshow / in-gallery
      const imgSelectors = [
        "[class*='nd-slideshow'] img",
        "[class*='in-gallery'] img",
        "[class*='in-photoGallery'] img",
        "[class*='Gallery'] img",
        "[class*='gallery'] img",
        "[class*='carousel'] img",
        "[class*='slider'] img",
        "[class*='in-detail__mainPhoto'] img",
        "picture source[srcset]",
      ];
      for (const sel of imgSelectors) {
        if (detail.images.length > 0) break;
        try {
          document.querySelectorAll(sel).forEach(el => {
            const src = el.dataset?.src || el.src || el.getAttribute("srcset")?.split(",")[0]?.trim()?.split(" ")[0] || "";
            if (src && !src.includes("placeholder") && !src.includes("avatar") && !src.includes("data:") && !src.includes("logo")) {
              // Try to get the largest variant
              const largeSrc = src
                .replace(/\/small\//, "/large/")
                .replace(/\/thumb\//, "/large/")
                .replace(/_small\./, "_large.")
                .replace(/_thumb\./, "_large.")
                .replace(/\?.*$/, ""); // Remove query params for cleaner URLs
              detail.images.push(largeSrc);
            }
          });
        } catch {}
      }

      // Also try background images in gallery
      if (detail.images.length === 0) {
        document.querySelectorAll("[class*='gallery'] [style*='background-image'], [class*='slider'] [style*='background-image'], [class*='Gallery'] [style*='background-image']").forEach(el => {
          const style = el.style.backgroundImage || "";
          const match = style.match(/url\(["']?(.+?)["']?\)/);
          if (match && match[1] && !match[1].includes("placeholder")) {
            detail.images.push(match[1]);
          }
        });
      }

      // Feature key-value pairs from the detail page
      // immobiliare.it uses dl/dt/dd pairs and also div-based layouts
      // with classes like in-realEstateFeatures, nd-list, etc.
      const featureContainerSelectors = [
        "dl.in-realEstateFeatures__list",
        "[class*='in-realEstateFeatures']",
        "[class*='nd-list--features']",
        "dl[class*='feature']",
        "dl[class*='detail']",
        "[class*='RealEstateFeatures']",
        "section[class*='features']",
        "div[class*='features']",
      ];

      for (const sel of featureContainerSelectors) {
        try {
          document.querySelectorAll(sel).forEach(container => {
            // Try dt/dd pairs first
            const dts = container.querySelectorAll("dt");
            const dds = container.querySelectorAll("dd");
            if (dts.length > 0 && dds.length > 0) {
              for (let i = 0; i < dts.length && i < dds.length; i++) {
                const label = (dts[i].textContent || "").trim().toLowerCase();
                const value = (dds[i].textContent || "").trim();
                if (label.includes("superficie") || label.includes("mq") || label.includes("m\u00B2")) {
                  detail.area = parseFloat(value.replace(/[^0-9.,]/g, "").replace(",", ".")) || detail.area;
                }
                if (label.includes("locali") || label.includes("vani") || label.includes("stanze")) {
                  detail.rooms = parseInt(value) || detail.rooms;
                }
                if (label.includes("piano") && !label.includes("piani totali") && !label.includes("piani edificio")) {
                  detail.floor = parseInt(value) || detail.floor;
                }
                if (label.includes("piani totali") || label.includes("piani edificio") || label.includes("totale piani")) {
                  detail.totalFloors = parseInt(value) || detail.totalFloors;
                }
                if (label.includes("anno") || label.includes("costruzione")) {
                  detail.yearBuilt = parseInt(value) || detail.yearBuilt;
                }
                if (label.includes("bagn")) {
                  detail.bathrooms = parseInt(value) || detail.bathrooms;
                }
                if (label.includes("stato") || label.includes("condizione")) {
                  detail.condition = detail.condition || value;
                }
                if (label.includes("tipologia") || label.includes("tipo immobile")) {
                  detail.propertyType = detail.propertyType || value;
                }
              }
            }

            // Also try label/value class pairs (div-based layout)
            const labels = container.querySelectorAll("[class*='label'], [class*='Label'], th");
            const values = container.querySelectorAll("[class*='value'], [class*='Value'], td");
            if (labels.length > 0 && values.length > 0) {
              for (let i = 0; i < labels.length && i < values.length; i++) {
                const label = (labels[i].textContent || "").trim().toLowerCase();
                const value = (values[i].textContent || "").trim();
                if (label.includes("superficie") || label.includes("mq")) {
                  detail.area = parseFloat(value.replace(/[^0-9.,]/g, "").replace(",", ".")) || detail.area;
                }
                if (label.includes("locali") || label.includes("vani")) {
                  detail.rooms = parseInt(value) || detail.rooms;
                }
                if (label.includes("piano") && !label.includes("piani")) {
                  detail.floor = parseInt(value) || detail.floor;
                }
                if (label.includes("piani")) {
                  detail.totalFloors = parseInt(value) || detail.totalFloors;
                }
                if (label.includes("anno") || label.includes("costruzione")) {
                  detail.yearBuilt = parseInt(value) || detail.yearBuilt;
                }
                if (label.includes("bagn")) {
                  detail.bathrooms = parseInt(value) || detail.bathrooms;
                }
                if (label.includes("stato")) {
                  detail.condition = detail.condition || value;
                }
                if (label.includes("tipologia")) {
                  detail.propertyType = detail.propertyType || value;
                }
              }
            }
          });
        } catch {}
      }

      // Feature list items (li-based)
      const featureListSelectors = [
        "[class*='in-realEstateFeatures'] li",
        "[class*='FeatureList'] li",
        "[class*='featureList'] li",
        "[class*='feature-list'] li",
        "li.lif__item",
      ];
      for (const sel of featureListSelectors) {
        try {
          document.querySelectorAll(sel).forEach(li => {
            const text = (li.textContent || "").trim().toLowerCase();
            if (text.includes("superficie") || text.includes("m\u00B2") || text.includes("mq")) {
              detail.area = parseFloat(text.replace(/[^0-9.,]/g, "").replace(",", ".")) || detail.area;
            }
            if (text.includes("locali") || text.includes("vani")) {
              detail.rooms = parseInt(text.replace(/[^0-9]/g, "")) || detail.rooms;
            }
            if (text.includes("piano")) {
              detail.floor = parseInt(text.replace(/[^0-9]/g, "")) || detail.floor;
            }
            if (text.includes("bagn")) {
              detail.bathrooms = parseInt(text.replace(/[^0-9]/g, "")) || detail.bathrooms;
            }
          });
        } catch {}
      }

      // Boolean amenities -- look in features/other-features sections
      const featSectionSelectors = [
        "[class*='in-realEstateFeatures']",
        "[class*='in-additionalFeatures']",
        "[class*='amenities']",
        "[class*='Amenities']",
        "[class*='other-features']",
        "[class*='otherFeatures']",
        "section[class*='features']",
      ];
      let featText = "";
      for (const sel of featSectionSelectors) {
        try {
          const el = document.querySelector(sel);
          if (el) {
            featText += " " + (el.textContent || "").toLowerCase();
          }
        } catch {}
      }

      if (featText.length > 0) {
        detail.balcony = detail.balcony || featText.includes("balcon");
        detail.garden = detail.garden || featText.includes("giardin");
        detail.cellar = detail.cellar || featText.includes("cantin") || featText.includes("seminterrato");
        detail.elevator = detail.elevator || featText.includes("ascensor");
      }

      // Description -- immobiliare.it uses in-readAll or in-description
      const descSelectors = [
        "[class*='in-readAll']",
        "[class*='in-description']",
        "[class*='description__body']",
        "[class*='descriptionText']",
        "[class*='Description'] p",
        "[class*='description'] p",
        "[data-testid='description']",
      ];
      for (const sel of descSelectors) {
        if (detail.description) break;
        try {
          const el = document.querySelector(sel);
          if (el) {
            detail.description = (el.textContent || "").trim().slice(0, 2000);
          }
        } catch {}
      }

      return detail;
    });
  } catch (e) {
    console.error(`  Detail ${listingId}: ${e.message}`);
    return null;
  }
}

// ===== Insert property =====
async function insertProperty(prop, search, r2Images) {
  const immId = String(prop.id);
  const slug = slugify(prop.title || prop.address || `immobile-${immId}`) + `-imm${immId}`;

  const { data: dup } = await sb.from("properties").select("id").eq("slug", slug).maybeSingle();
  if (dup) return { skipped: true };

  const city = prop.city || search.city;
  const rooms = prop.rooms || 0;

  const property = {
    slug,
    title: prop.title || `Immobile a ${city}`,
    listing_type: search.type,
    category: mapCategory(prop.propertyType),
    subtype: "ostatni",
    rooms_label: rooms > 0 ? `${rooms} locali` : "",
    price: prop.price || 0,
    price_currency: "eur",
    price_unit: search.type === "rent" ? "za_mesic" : undefined,
    city,
    district: prop.district || "",
    location_label: prop.address || city,
    latitude: prop.latitude || 0,
    longitude: prop.longitude || 0,
    area: prop.area || 0,
    floor: prop.floor || undefined,
    total_floors: prop.totalFloors || undefined,
    year_built: prop.yearBuilt || undefined,
    bathrooms: prop.bathrooms || undefined,
    balcony: prop.balcony || false,
    garden: prop.garden || false,
    cellar: prop.cellar || false,
    elevator: prop.elevator || false,
    summary: (prop.title || prop.address || "").slice(0, 300),
    description: prop.description || undefined,
    image_src: r2Images[0] || "/branding/placeholder.png",
    image_alt: prop.title || `Immobile a ${city}`,
    images: r2Images,
    featured: false,
    active: true,
    source: "immobiliare",
    country: "it",
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
  Immobiliare.it Scraper v3 (Playwright + Stealth) | Pages: ${PAGES} | Delay: ${DELAY_MS}ms
  Searches: ${SEARCHES.map(s => s.label).join(", ")}
`);

  const state = loadState();
  const t0 = Date.now();

  const browser = await chromium.launch({
    headless: true,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--disable-features=IsolateOrigins,site-per-process",
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--disable-gpu",
      "--window-size=1920,1080",
    ],
  });

  const context = await browser.newContext({
    userAgent: UA,
    viewport: { width: 1920, height: 1080 },
    locale: "it-IT",
    timezoneId: "Europe/Rome",
    geolocation: { latitude: 41.9028, longitude: 12.4964 }, // Rome
    permissions: ["geolocation"],
    extraHTTPHeaders: {
      "Accept-Language": "it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      "Accept-Encoding": "gzip, deflate, br",
      "Cache-Control": "max-age=0",
      "Sec-Ch-Ua": '"Not_A Brand";v="8", "Chromium";v="131", "Google Chrome";v="131"',
      "Sec-Ch-Ua-Mobile": "?0",
      "Sec-Ch-Ua-Platform": '"macOS"',
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
      "Sec-Fetch-User": "?1",
      "Upgrade-Insecure-Requests": "1",
    },
  });

  // Inject stealth script BEFORE any page loads
  await context.addInitScript(STEALTH_SCRIPT);

  const page = await context.newPage();

  // ----- Step 1: Pre-set consent cookies before first navigation -----
  console.log("  Setting consent cookies before navigation...");
  try {
    await context.addCookies([
      {
        name: "didomi_token",
        value: "eyJ1c2VyX2lkIjoiMTkzNTRhZDAtMDAwMC0wMDAwLTAwMDAtMDAwMDAwMDAwMDAwIiwiY3JlYXRlZCI6IjIwMjUtMDEtMDFUMDA6MDA6MDAuMDAwWiIsInVwZGF0ZWQiOiIyMDI1LTAxLTAxVDAwOjAwOjAwLjAwMFoiLCJ2ZXJzaW9uIjoyLCJwdXJwb3NlcyI6eyJlbmFibGVkIjpbImNvb2tpZXMiLCJhZHZlcnRpc2luZ19wZXJzb25hbGl6YXRpb24iLCJjb250ZW50X3BlcnNvbmFsaXphdGlvbiIsImFkX2RlbGl2ZXJ5IiwiYW5hbHl0aWNzIl19LCJ2ZW5kb3JzIjp7ImVuYWJsZWQiOlsiZ29vZ2xlIiwiYzppbW1vYmlsaWFyZSJdfX0=",
        domain: ".immobiliare.it",
        path: "/",
        httpOnly: false,
        secure: false,
        sameSite: "Lax",
      },
      {
        name: "euconsent-v2",
        value: "CQHzEAAQHzEAAAHABBITBRFgAPAAAH_gAAAAAAAAAA2gBwAOAAeABIADMAHgAQAAigBSAC4AGMAZgA0AB2AEEAIgASwApABdADQAHIAP4AhIBFgCOAE2AJ4AUwAtABhgDRAG0ANwAcgA6gB7AEKAIiASYAmwBRgCogFkALiAX4AxABkgDOAGiANoAbwA4gB0gDuAH2AQIAhYBFgCOgEdAJcATIAnQBTwCwAF5AMUAZIAy4BogDcAHIAPUAe4A_ACGAE0AJ4AXIAxQBvgDzAH6ASIApABbADDAGYAN4AfQBEACOAFcALMAbIA6QB9gEOAIqAR4AowBUQCxAF5ALyAYQAxYBpADcgHCAOqAfMBAoCGQENAIiASoAtgBegDIgGhANIAdgA74CIgEzAJuAUEArQBawC9AGOAMmAbgA4oBywD4gH1AQOAhcBH4CUQEtAJ0AUQAqsBYAC8gGKAN-AegA_IB_QEHgIiAR4Aj4BLoCbAE_AKEAUeAtABagDFAGaANEAc0A6QB7gD8gIDAQYAiYBKgCpgFZALYAXkAwABkgDRAG0AOIAf4BAgCNAEfgJNATYAoIBSQCxAGGAM0AbYA5ACIAEdAJkAUYAo4BWACzAGSANuAb4A8wCHAEfAJUASwAqABYcDBAGKAN-AfUBA4CHAEaAJUAWwAvIBigDfgH5AQ-AikBLQCdAFEAKrAWAAu4BjADcgHVAPKAgMBDICGgERgJNATIApABdwDEAGXANIAdkA74CCAERAJmAT0AoIBWgC1gF6ANkAbkA4IBxQDlgHxAP8Ag4BHoCUQEtAKIAUcAqsBYAC8gGPAMsAbcA3wB5gEOAI-ATQA",
        domain: ".immobiliare.it",
        path: "/",
        httpOnly: false,
        secure: false,
        sameSite: "Lax",
      },
    ]);
    console.log("  Consent cookies pre-set");
  } catch (e) {
    console.log(`  Warning: could not pre-set consent cookies: ${e.message}`);
  }

  // ----- Step 2: Navigate to homepage and handle any remaining consent -----
  console.log("  Opening Immobiliare.it...");
  await page.goto("https://www.immobiliare.it", { waitUntil: "domcontentloaded", timeout: 30000 });
  await sleep(3000);

  // Try to accept cookies via UI if a consent banner still appears
  await acceptCookieConsent(page);
  await sleep(1000);

  // Verify the page loaded real content
  const homeBodyLen = await page.evaluate(() => (document.body?.textContent || "").length);
  const testTitle = await page.title();
  console.log(`  Page title: ${testTitle} (body length: ${homeBodyLen})`);

  if (homeBodyLen < 500) {
    console.log("  WARNING: Homepage body is very small -- consent wall may still be blocking");
    // Try one more time: reload after consent
    await page.reload({ waitUntil: "domcontentloaded", timeout: 30000 });
    await sleep(3000);
    await acceptCookieConsent(page);
    await sleep(2000);
    const homeBodyLen2 = await page.evaluate(() => (document.body?.textContent || "").length);
    console.log(`  After reload: body length = ${homeBodyLen2}`);
  }

  if (testTitle.includes("blocked") || testTitle.includes("Access Denied")) {
    console.error("  BLOCKED: Site is blocking headless browser. Try VPN.");
    await browser.close();
    process.exit(1);
  }

  for (const search of SEARCHES) {
    console.log(`\n== ${search.label} ==`);

    for (let p = 1; p <= PAGES; p++) {
      const pageUrl = p === 1 ? search.url : `${search.url}?pag=${p}`;

      await sleep(DELAY_MS);

      // Use navigateWithRetry for robust navigation with consent handling
      const navOk = await navigateWithRetry(page, pageUrl);
      if (!navOk) {
        console.log(`  Page ${p}: navigation failed after retries, skipping`);
        break;
      }

      // Wait for listing content to appear (try multiple selectors)
      try {
        await page.waitForSelector(
          "[id='__NEXT_DATA__'], li[class*='RealEstate'], li[class*='nd-list__item'], [class*='in-realEstateResults'], a[href*='/annunci/']",
          { timeout: 8000 }
        );
      } catch {
        // If none of the selectors matched, the page might still have data
        // in __NEXT_DATA__, so continue anyway
      }

      // Check for CAPTCHA
      const hasCaptcha = await page.locator("#captcha, [class*='captcha'], [class*='Captcha'], [class*='challenge']").isVisible({ timeout: 2000 }).catch(() => false);
      if (hasCaptcha) {
        console.log("  CAPTCHA detected, waiting 30s...");
        await sleep(30000);
      }

      const listings = await extractListings(page);
      if (listings.length === 0) {
        // Debug: log what we see on the page to help diagnose issues
        const debugInfo = await page.evaluate(() => {
          const hasNextData = !!document.getElementById("__NEXT_DATA__");
          const linkCount = document.querySelectorAll("a[href*='/annunci/']").length;
          const liCount = document.querySelectorAll("li").length;
          const bodyLen = (document.body?.textContent || "").length;
          // Grab a snippet of the page HTML for debugging
          const htmlSnippet = (document.documentElement?.outerHTML || "").slice(0, 500);
          // Check for consent/cookie elements
          const hasDidomi = !!document.getElementById("didomi-notice");
          const hasConsentOverlay = !!(
            document.querySelector("[class*='consent']") ||
            document.querySelector("[class*='cookie-wall']") ||
            document.querySelector("[class*='CookieWall']")
          );
          return { hasNextData, linkCount, liCount, bodyLen, htmlSnippet, hasDidomi, hasConsentOverlay };
        }).catch(() => ({}));
        console.log(`  Page ${p}: empty (debug: __NEXT_DATA__=${debugInfo.hasNextData}, annunci_links=${debugInfo.linkCount}, li=${debugInfo.liCount}, bodyLen=${debugInfo.bodyLen}, didomi=${debugInfo.hasDidomi}, consentOverlay=${debugInfo.hasConsentOverlay})`);
        if (debugInfo.htmlSnippet) {
          console.log(`  HTML snippet: ${debugInfo.htmlSnippet.replace(/\n/g, " ").slice(0, 300)}`);
        }
        break;
      }

      console.log(`  Page ${p}: ${listings.length} listings`);

      for (const prop of listings) {
        const immId = String(prop.id);
        if (!immId || state.seen[`imm-${immId}`]) { process.stdout.write("s"); continue; }

        try {
          // Detail page
          const detail = await extractDetail(page, immId, prop.detailUrl);
          if (detail) {
            if (detail.images.length > 0) prop.images = detail.images;
            if (detail.latitude) prop.latitude = detail.latitude;
            if (detail.longitude) prop.longitude = detail.longitude;
            if (detail.area) prop.area = detail.area;
            if (detail.rooms) prop.rooms = detail.rooms;
            if (detail.floor) prop.floor = detail.floor;
            if (detail.totalFloors) prop.totalFloors = detail.totalFloors;
            if (detail.yearBuilt) prop.yearBuilt = detail.yearBuilt;
            if (detail.bathrooms) prop.bathrooms = detail.bathrooms;
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
            const url = await uploadToR2(imgUrl, slugify(prop.title || immId));
            if (url) { r2Urls.push(url); state.stats.images++; }
          }

          const res = await insertProperty(prop, search, r2Urls);
          if (res.skipped) { state.stats.skipped++; process.stdout.write("d"); }
          else { state.stats.properties++; process.stdout.write("."); }

          state.seen[`imm-${immId}`] = true;
          if (state.stats.properties % 5 === 0) saveState(state);
        } catch (e) {
          state.stats.errors++;
          console.error(`\n  Err ${immId}: ${e.message}`);
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
