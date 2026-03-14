#!/usr/bin/env node
// ============================================================
// ImmobilienScout24.de Scraper v2 — Playwright edition
// German Real Estate — headless browser bypasses geo-blocking
// Usage: node scripts/scrape-immoscout24.mjs [--pages 5] [--delay 3000]
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
const STATE_FILE = resolve(ROOT, "scripts/.scrape-state-immoscout24.json");
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
  if (t.includes("wohnung") || t.includes("apartment") || t.includes("etagenwohnung") || t.includes("penthouse") || t.includes("loft") || t.includes("maisonette")) return "apartment";
  if (t.includes("haus") || t.includes("einfamilienhaus") || t.includes("reihenhaus") || t.includes("doppelhaus") || t.includes("villa") || t.includes("bungalow") || t.includes("mehrfamilienhaus")) return "house";
  if (t.includes("grundstück") || t.includes("grundstueck") || t.includes("grundstuck")) return "land";
  if (t.includes("gewerbe") || t.includes("büro") || t.includes("buero") || t.includes("laden") || t.includes("halle") || t.includes("praxis")) return "commercial";
  return "other";
}

// ===== Searches =====
const SEARCHES = [
  { url: "https://www.immobilienscout24.de/Suche/de/berlin/berlin/wohnung-kaufen", city: "Berlin", type: "sale", label: "Berlin Buy Apt" },
  { url: "https://www.immobilienscout24.de/Suche/de/berlin/berlin/wohnung-mieten", city: "Berlin", type: "rent", label: "Berlin Rent Apt" },
  { url: "https://www.immobilienscout24.de/Suche/de/bayern/muenchen-kreis/wohnung-kaufen", city: "München", type: "sale", label: "München Buy Apt" },
  { url: "https://www.immobilienscout24.de/Suche/de/bayern/muenchen-kreis/wohnung-mieten", city: "München", type: "rent", label: "München Rent Apt" },
  { url: "https://www.immobilienscout24.de/Suche/de/hamburg/hamburg/wohnung-kaufen", city: "Hamburg", type: "sale", label: "Hamburg Buy Apt" },
  { url: "https://www.immobilienscout24.de/Suche/de/hamburg/hamburg/wohnung-mieten", city: "Hamburg", type: "rent", label: "Hamburg Rent Apt" },
  { url: "https://www.immobilienscout24.de/Suche/de/nordrhein-westfalen/koeln/wohnung-kaufen", city: "Köln", type: "sale", label: "Köln Buy Apt" },
  { url: "https://www.immobilienscout24.de/Suche/de/hessen/frankfurt-am-main/wohnung-kaufen", city: "Frankfurt", type: "sale", label: "Frankfurt Buy Apt" },
  { url: "https://www.immobilienscout24.de/Suche/de/berlin/berlin/haus-kaufen", city: "Berlin", type: "sale", label: "Berlin Buy House" },
  { url: "https://www.immobilienscout24.de/Suche/de/bayern/muenchen-kreis/haus-kaufen", city: "München", type: "sale", label: "München Buy House" },
];

// ===== Extract listings from search page =====
async function extractListings(page) {
  return await page.evaluate(() => {
    const results = [];

    // Method 1: Try IS24 result list data from embedded JSON
    const scripts = document.querySelectorAll("script[type='application/json'], script[type='application/ld+json']");
    for (const s of scripts) {
      try {
        const data = JSON.parse(s.textContent || "");
        // JSON-LD
        if (data["@type"] === "ItemList" && data.itemListElement) {
          for (const item of data.itemListElement) {
            const offer = item.item || item;
            results.push({
              id: String(offer["@id"] || offer.url?.match(/(\d+)$/)?.[1] || ""),
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
            });
          }
        }
      } catch {}
    }

    if (results.length > 0) return results;

    // Method 2: Parse DOM result list entries
    document.querySelectorAll("[data-item='result'], .result-list-entry, article[data-id]").forEach(el => {
      const id = el.dataset.obid || el.dataset.id || el.getAttribute("data-go-to-expose-id") || "";
      if (!id) return;

      const titleEl = el.querySelector("h5, [data-is24-qa='listing-title'], .result-list-entry__brand-title");
      const title = titleEl?.textContent?.trim() || "";

      const priceEl = el.querySelector("[data-is24-qa='listing-price'], .result-list-entry__criteria dd:first-of-type, .grid-item:first-child dd");
      const priceText = priceEl?.textContent?.trim() || "0";
      const price = Number(priceText.replace(/[^0-9]/g, "")) || 0;

      const addressEl = el.querySelector("[data-is24-qa='listing-address'], .result-list-entry__address button");
      const address = addressEl?.textContent?.trim() || "";

      const areaEl = el.querySelector("[data-is24-qa='listing-area'], .grid-item:nth-child(2) dd");
      const area = parseFloat(areaEl?.textContent || "0") || 0;

      const roomsEl = el.querySelector("[data-is24-qa='listing-rooms'], .grid-item:nth-child(3) dd");
      const rooms = parseFloat(roomsEl?.textContent || "0") || 0;

      const imgEl = el.querySelector("img[data-lazy-src], img.result-list-entry__brand-logo, img");
      const imgSrc = imgEl?.dataset?.lazySrc || imgEl?.src || "";

      results.push({
        id: String(id),
        title: title || address,
        price,
        address,
        city: "",
        area,
        rooms,
        propertyType: "",
        images: imgSrc && !imgSrc.includes("placeholder") ? [imgSrc] : [],
        latitude: 0,
        longitude: 0,
      });
    });

    return results;
  });
}

// ===== Extract detail from expose page =====
async function extractDetail(page, exposeId) {
  const url = `https://www.immobilienscout24.de/expose/${exposeId}`;
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
    await sleep(2000);

    return await page.evaluate(() => {
      const detail = { images: [], description: "", area: 0, rooms: 0, floor: 0, totalFloors: 0, yearBuilt: 0, latitude: 0, longitude: 0, balcony: false, garden: false, cellar: false, elevator: false, condition: "", propertyType: "" };

      // JSON-LD on expose page
      const scripts = document.querySelectorAll("script[type='application/ld+json']");
      for (const s of scripts) {
        try {
          const data = JSON.parse(s.textContent || "");
          if (data["@type"] === "Residence" || data["@type"] === "Apartment" || data["@type"] === "House" || data["@type"] === "SingleFamilyResidence") {
            detail.area = parseFloat(data.floorSize?.value || "0") || 0;
            detail.rooms = parseInt(data.numberOfRooms || "0") || 0;
            detail.latitude = parseFloat(data.geo?.latitude || "0") || 0;
            detail.longitude = parseFloat(data.geo?.longitude || "0") || 0;
            detail.images = data.image ? (Array.isArray(data.image) ? data.image : [data.image]) : [];
            detail.propertyType = data["@type"] || "";
          }
        } catch {}
      }

      // Gallery images
      if (detail.images.length === 0) {
        document.querySelectorAll(".sp-slide img, .gallery-container img, [data-testid='gallery'] img").forEach(img => {
          const src = img.dataset?.lazySrc || img.src || "";
          if (src && !src.includes("placeholder") && !src.includes("avatar")) detail.images.push(src);
        });
      }

      // Feature table
      document.querySelectorAll("dl.is24qa-attribute, .is24-value, .criteriagroup .grid-item").forEach(el => {
        const label = el.querySelector("dt")?.textContent?.trim()?.toLowerCase() || "";
        const value = el.querySelector("dd")?.textContent?.trim() || "";
        if (label.includes("wohnfläche") || label.includes("living space")) detail.area = parseFloat(value) || detail.area;
        if (label.includes("zimmer") || label.includes("rooms")) detail.rooms = parseFloat(value) || detail.rooms;
        if (label.includes("etage") && !label.includes("etagen")) detail.floor = parseInt(value) || 0;
        if (label.includes("etagen") || label.includes("geschosse")) detail.totalFloors = parseInt(value) || 0;
        if (label.includes("baujahr") || label.includes("year")) detail.yearBuilt = parseInt(value) || 0;
        if (label.includes("zustand") || label.includes("condition")) detail.condition = value;
        if (label.includes("balkon") && (value.includes("Ja") || value.includes("yes"))) detail.balcony = true;
        if (label.includes("garten") && (value.includes("Ja") || value.includes("yes"))) detail.garden = true;
        if (label.includes("keller") && (value.includes("Ja") || value.includes("yes"))) detail.cellar = true;
        if (label.includes("aufzug") || label.includes("fahrstuhl")) detail.elevator = value.includes("Ja") || value.includes("yes");
      });

      // Description
      const descEl = document.querySelector("[data-is24-qa='is24qa-Freitexte'], .is24qa-objektbeschreibung, [data-qa='description']");
      detail.description = descEl?.textContent?.trim()?.slice(0, 2000) || "";

      return detail;
    });
  } catch (e) {
    console.error(`  Detail ${exposeId}: ${e.message}`);
    return null;
  }
}

// ===== Insert property =====
async function insertProperty(prop, search, r2Images) {
  const is24Id = String(prop.id);
  const slug = slugify(prop.title || prop.address || `immobilie-${is24Id}`) + `-is24${is24Id}`;

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
    source: "immoscout24",
    country: "de",
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
  ImmobilienScout24.de Scraper v2 (Playwright) | Pages: ${PAGES} | Delay: ${DELAY_MS}ms
  Searches: ${SEARCHES.map(s => s.label).join(", ")}
`);

  const state = loadState();
  const t0 = Date.now();

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: UA,
    viewport: { width: 1920, height: 1080 },
    locale: "de-DE",
    geolocation: { latitude: 52.52, longitude: 13.405 }, // Berlin
    permissions: ["geolocation"],
  });

  const page = await context.newPage();
  console.log("  Opening ImmobilienScout24...");
  await page.goto("https://www.immobilienscout24.de", { waitUntil: "domcontentloaded", timeout: 30000 });
  await sleep(3000);

  // Accept cookies
  try {
    const cookieBtn = page.locator("#uc-btn-accept-banner, button:has-text('Einverstanden'), button:has-text('Accept')");
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
    console.error("  BLOCKED: Site is blocking even headless browser. Try VPN.");
    await browser.close();
    process.exit(1);
  }

  for (const search of SEARCHES) {
    console.log(`\n== ${search.label} ==`);

    for (let p = 1; p <= PAGES; p++) {
      const pageUrl = p === 1 ? search.url : `${search.url}?pagenumber=${p}`;

      await sleep(DELAY_MS);
      try {
        await page.goto(pageUrl, { waitUntil: "domcontentloaded", timeout: 25000 });
        await sleep(3000);

        // Check for CAPTCHA
        const hasCaptcha = await page.locator("#captcha, .geetest_holder, [class*='captcha']").isVisible({ timeout: 2000 }).catch(() => false);
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
        const is24Id = String(prop.id);
        if (!is24Id || state.seen[`is24-${is24Id}`]) { process.stdout.write("s"); continue; }

        try {
          // Detail page
          const detail = await extractDetail(page, is24Id);
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
            const url = await uploadToR2(imgUrl, slugify(prop.title || is24Id));
            if (url) { r2Urls.push(url); state.stats.images++; }
          }

          const res = await insertProperty(prop, search, r2Urls);
          if (res.skipped) { state.stats.skipped++; process.stdout.write("d"); }
          else { state.stats.properties++; process.stdout.write("."); }

          state.seen[`is24-${is24Id}`] = true;
          if (state.stats.properties % 5 === 0) saveState(state);
        } catch (e) {
          state.stats.errors++;
          console.error(`\n  Err ${is24Id}: ${e.message}`);
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
