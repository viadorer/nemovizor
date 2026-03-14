#!/usr/bin/env node
// ============================================================
// Rightmove.co.uk Scraper v2 — Playwright edition
// UK Real Estate — headless browser bypasses anti-bot
// Usage: node scripts/scrape-rightmove.mjs [--pages 5] [--delay 3000]
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
const STATE_FILE = resolve(ROOT, "scripts/.scrape-state-rightmove.json");
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
    const ext = imageUrl.includes(".png") ? "png" : "jpg";
    const key = `uploads/images/${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${slug.slice(0, 40)}.${ext}`;
    await r2.send(new PutObjectCommand({
      Bucket: R2_BUCKET_NAME, Key: key, Body: buf,
      ContentType: `image/${ext === "png" ? "png" : "jpeg"}`,
      CacheControl: "public, max-age=31536000, immutable",
    }));
    return R2_PUBLIC_URL ? `${R2_PUBLIC_URL}/${key}` : key;
  } catch { return null; }
}

// ===== Category mapping =====
function mapCategory(rmType) {
  if (!rmType) return "apartment";
  const t = rmType.toLowerCase();
  if (t.includes("flat") || t.includes("apartment") || t.includes("maisonette") || t.includes("studio")) return "apartment";
  if (t.includes("house") || t.includes("bungalow") || t.includes("cottage") || t.includes("villa") || t.includes("detached") || t.includes("semi-detached") || t.includes("terraced")) return "house";
  if (t.includes("land") || t.includes("plot")) return "land";
  if (t.includes("commercial") || t.includes("office") || t.includes("shop") || t.includes("retail") || t.includes("warehouse")) return "commercial";
  return "other";
}

// ===== Search regions =====
const REGIONS = [
  { id: "REGION%5E87490", name: "London" },
  { id: "REGION%5E904", name: "Manchester" },
  { id: "REGION%5E162", name: "Birmingham" },
  { id: "REGION%5E475", name: "Edinburgh" },
  { id: "REGION%5E219", name: "Bristol" },
  { id: "REGION%5E786", name: "Leeds" },
];

// ===== Extract properties from page via Playwright =====
async function extractPropertiesFromPage(page) {
  return await page.evaluate(() => {
    const results = [];

    // Method 1: window.jsonModel (search results page)
    if (window.jsonModel?.properties) {
      for (const p of window.jsonModel.properties) {
        results.push({
          id: String(p.id || ""),
          price: p.price?.amount || 0,
          priceLabel: p.price?.displayPrices?.[0]?.displayPrice || "",
          address: p.displayAddress || "",
          propertyType: p.propertySubType || p.propertyType || "",
          bedrooms: p.bedrooms || 0,
          bathrooms: p.bathrooms || 0,
          summary: p.summary || "",
          images: (p.propertyImages?.images || []).map(i => i.srcUrl || i.url).filter(Boolean),
          latitude: p.location?.latitude || 0,
          longitude: p.location?.longitude || 0,
          agent: p.customer?.branchDisplayName || "",
          addedDate: p.addedOrReduced || "",
        });
      }
      return results;
    }

    // Method 2: parse DOM property cards
    document.querySelectorAll(".l-searchResult, .propertyCard, [data-test='propertyCard']").forEach(el => {
      const idAttr = el.id?.replace("property-", "") || el.dataset?.propertyId || "";
      if (!idAttr) return;

      const priceEl = el.querySelector(".propertyCard-priceValue, [data-test='asking-price']");
      const priceText = priceEl?.textContent?.trim() || "0";
      const price = Number(priceText.replace(/[^0-9]/g, "")) || 0;

      const addressEl = el.querySelector(".propertyCard-address, address, [data-test='address']");
      const address = addressEl?.textContent?.trim() || "";

      const typeEl = el.querySelector(".property-information span:first-child, .propertyCard-details .property-information span");
      const propertyType = typeEl?.textContent?.trim() || "";

      const bedsEl = el.querySelector(".property-information span:nth-child(2)");
      const bedrooms = parseInt(bedsEl?.textContent || "0") || 0;

      const imgEl = el.querySelector("img.propertyCard-img, img[data-test='property-img']");
      const imgSrc = imgEl?.src || "";

      const linkEl = el.querySelector("a.propertyCard-link, a[data-test='property-details']");
      const link = linkEl?.href || "";

      const agentEl = el.querySelector(".propertyCard-branchSummary-branchName, [data-test='branch-name']");
      const agent = agentEl?.textContent?.trim() || "";

      results.push({
        id: String(idAttr),
        price,
        priceLabel: priceText,
        address,
        propertyType,
        bedrooms,
        bathrooms: 0,
        summary: address,
        images: imgSrc ? [imgSrc] : [],
        latitude: 0,
        longitude: 0,
        agent,
        addedDate: "",
      });
    });

    return results;
  });
}

// ===== Extract detail from property page =====
async function extractPropertyDetail(page, propertyId) {
  const url = `https://www.rightmove.co.uk/properties/${propertyId}`;
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
    await sleep(1500);

    return await page.evaluate(() => {
      const detail = { images: [], description: "", area: 0, latitude: 0, longitude: 0, bedrooms: 0, bathrooms: 0, propertyType: "" };

      // PAGE_MODEL has everything
      if (window.PAGE_MODEL?.propertyData) {
        const pd = window.PAGE_MODEL.propertyData;
        detail.images = (pd.images || []).map(i => i.url || i.srcUrl).filter(Boolean);
        detail.latitude = pd.location?.latitude || 0;
        detail.longitude = pd.location?.longitude || 0;
        detail.bedrooms = pd.bedrooms || 0;
        detail.bathrooms = pd.bathrooms || 0;
        detail.propertyType = pd.propertySubType || pd.propertyType || "";
        detail.description = pd.text?.description || "";
        if (pd.sizings?.[0]) {
          const sz = pd.sizings[0];
          const sqm = sz.unit === "sqm" ? (sz.minimumSize || sz.maximumSize || 0) : 0;
          const sqft = sz.unit === "sqft" ? (sz.minimumSize || sz.maximumSize || 0) : 0;
          detail.area = sqm || Math.round(sqft * 0.0929) || 0;
        }
      }

      // Fallback: OG images
      if (detail.images.length === 0) {
        document.querySelectorAll("meta[property='og:image']").forEach(el => {
          const src = el.content;
          if (src) detail.images.push(src);
        });
      }

      return detail;
    });
  } catch (e) {
    console.error(`  Detail ${propertyId}: ${e.message}`);
    return null;
  }
}

// ===== Insert property =====
async function insertProperty(prop, listingType, regionName, r2Images) {
  const rmId = String(prop.id);
  const slug = slugify(prop.address || `property-${rmId}`) + `-rm${rmId}`;

  const { data: dup } = await sb.from("properties").select("id").eq("slug", slug).maybeSingle();
  if (dup) return { skipped: true };

  const parts = (prop.address || "").split(",").map(s => s.trim());
  const city = parts[parts.length - 1] || regionName;
  const district = parts.length > 1 ? parts[0] : "";

  const property = {
    slug,
    title: `${prop.propertyType || "Property"} - ${prop.address || regionName}`,
    listing_type: listingType,
    category: mapCategory(prop.propertyType),
    subtype: "ostatni",
    rooms_label: prop.bedrooms ? `${prop.bedrooms} bed` : "",
    price: prop.price || 0,
    price_currency: "gbp",
    price_unit: listingType === "rent" ? "za_mesic" : undefined,
    city,
    district,
    location_label: prop.address || regionName,
    latitude: prop.latitude || 0,
    longitude: prop.longitude || 0,
    area: prop.area || 0,
    summary: (prop.summary || prop.address || "").slice(0, 300),
    description: prop.description || undefined,
    image_src: r2Images[0] || "/branding/placeholder.png",
    image_alt: prop.address || `Property in ${regionName}`,
    images: r2Images,
    featured: false,
    active: true,
    source: "rightmove",
    country: "gb",
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
  Rightmove.co.uk Scraper v2 (Playwright) | Pages: ${PAGES} | Delay: ${DELAY_MS}ms
  Regions: ${REGIONS.map(r => r.name).join(", ")}
`);

  const state = loadState();
  const t0 = Date.now();

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: UA,
    viewport: { width: 1920, height: 1080 },
    locale: "en-GB",
  });

  // Accept cookies on first visit
  const page = await context.newPage();
  console.log("  Opening Rightmove...");
  await page.goto("https://www.rightmove.co.uk", { waitUntil: "domcontentloaded", timeout: 30000 });
  await sleep(2000);

  // Accept cookies if dialog appears
  try {
    const cookieBtn = page.locator("button:has-text('Accept'), button:has-text('Agree'), #onetrust-accept-btn-handler");
    if (await cookieBtn.isVisible({ timeout: 3000 })) {
      await cookieBtn.click();
      console.log("  Cookies accepted");
      await sleep(1000);
    }
  } catch {}

  const channels = [
    { path: "property-for-sale/find.html", type: "sale", channel: "BUY" },
    { path: "property-to-rent/find.html", type: "rent", channel: "RENT" },
  ];

  for (const region of REGIONS) {
    for (const ch of channels) {
      const label = `${region.name} - ${ch.type === "sale" ? "Buy" : "Rent"}`;
      console.log(`\n== ${label} ==`);

      for (let p = 0; p < PAGES; p++) {
        const index = p * 24;
        const url = `https://www.rightmove.co.uk/${ch.path}?locationIdentifier=${region.id}&sortType=6&index=${index}&channel=${ch.channel}&viewType=LIST`;

        await sleep(DELAY_MS);
        try {
          await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25000 });
          await sleep(2000);
        } catch (e) {
          console.error(`  Nav error: ${e.message}`);
          continue;
        }

        const listings = await extractPropertiesFromPage(page);
        if (listings.length === 0) { console.log(`  Page ${p + 1}: empty, next`); break; }

        console.log(`  Page ${p + 1}: ${listings.length} listings`);

        for (const prop of listings) {
          const rmId = String(prop.id);
          if (!rmId || state.seen[`rm-${rmId}`]) { process.stdout.write("s"); continue; }

          try {
            // Get detail page for images, geo, area
            const detail = await extractPropertyDetail(page, rmId);
            if (detail) {
              if (detail.images.length > 0) prop.images = detail.images;
              if (detail.latitude) prop.latitude = detail.latitude;
              if (detail.longitude) prop.longitude = detail.longitude;
              if (detail.area) prop.area = detail.area;
              if (detail.description) prop.description = detail.description;
            }

            await sleep(DELAY_MS);

            // Upload images
            const r2Urls = [];
            for (const imgUrl of (prop.images || []).slice(0, MAX_IMAGES)) {
              if (!imgUrl || imgUrl.startsWith("data:")) continue;
              const url = await uploadToR2(imgUrl, slugify(prop.address || rmId));
              if (url) { r2Urls.push(url); state.stats.images++; }
            }

            const res = await insertProperty(prop, ch.type, region.name, r2Urls);
            if (res.skipped) { state.stats.skipped++; process.stdout.write("d"); }
            else { state.stats.properties++; process.stdout.write("."); }

            state.seen[`rm-${rmId}`] = true;
            if (state.stats.properties % 5 === 0) saveState(state);
          } catch (e) {
            state.stats.errors++;
            console.error(`\n  Err ${rmId}: ${e.message}`);
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
