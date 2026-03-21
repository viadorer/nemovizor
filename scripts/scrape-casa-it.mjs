#!/usr/bin/env node
// ============================================================
// Casa.it Scraper — Playwright edition
// Italy Real Estate — extracts __NEXT_DATA__ from Next.js pages
// Usage: node scripts/scrape-casa-it.mjs [--pages 5] [--delay 4000]
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
const DELAY_MS = Number(getArg("--delay", "4000"));
const MAX_IMAGES = 8;
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

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
const STATE_FILE = resolve(ROOT, "scripts/.scrape-state-casa-it.json");
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

// ===== Category mapping (Italian property types) =====
function mapCategory(tipo) {
  if (!tipo) return "apartment";
  const t = tipo.toLowerCase();
  if (t.includes("appartament") || t.includes("attico") || t.includes("loft") || t.includes("monolocale") || t.includes("bilocale") || t.includes("trilocale")) return "apartment";
  if (t.includes("villa") || t.includes("villetta") || t.includes("casa") || t.includes("bifamiliare") || t.includes("indipendente") || t.includes("schiera") || t.includes("rustico") || t.includes("casale") || t.includes("colonica")) return "house";
  if (t.includes("terreno") || t.includes("agricolo")) return "land";
  if (t.includes("ufficio") || t.includes("negozio") || t.includes("commerciale") || t.includes("magazzino") || t.includes("capannone") || t.includes("laboratorio")) return "commercial";
  return "other";
}

// ===== Cities =====
const CITIES = [
  { slug: "roma", name: "Roma" },
  { slug: "milano", name: "Milano" },
  { slug: "firenze", name: "Firenze" },
  { slug: "napoli", name: "Napoli" },
  { slug: "torino", name: "Torino" },
  { slug: "bologna", name: "Bologna" },
  { slug: "venezia", name: "Venezia" },
  { slug: "genova", name: "Genova" },
  { slug: "palermo", name: "Palermo" },
  { slug: "verona", name: "Verona" },
];

// ===== Listing channels =====
const CHANNELS = [
  { pathPrefix: "vendita/residenziale", type: "sale" },
  { pathPrefix: "affitto/residenziale", type: "rent" },
];

// ===== Extract listings from __NEXT_DATA__ =====
function parseNextDataListings(nextData) {
  const listings = [];
  try {
    const props = nextData?.props?.pageProps;
    if (!props) return listings;

    // Casa.it stores search results in various locations — try common paths
    const searchResults =
      props.searchResults?.results ||
      props.results ||
      props.listings ||
      props.realEstateAds ||
      props.ads ||
      props.properties ||
      [];

    // Also check nested data structures
    const items = Array.isArray(searchResults) ? searchResults : (searchResults?.items || searchResults?.list || []);

    for (const item of items) {
      const id = String(
        item.id || item.realEstateId || item.listingId || item.adId || ""
      );
      if (!id) continue;

      // Price extraction — try multiple paths
      const price =
        item.price?.value ||
        item.price?.main?.value ||
        item.price?.amount ||
        item.price ||
        0;
      const priceNum = typeof price === "number" ? price : Number(String(price).replace(/[^0-9]/g, "")) || 0;

      // Address / location
      const address =
        item.address ||
        item.location?.address ||
        item.title ||
        item.description?.title ||
        "";

      const propertyType =
        item.typology?.name ||
        item.propertyType ||
        item.category?.name ||
        item.type ||
        "";

      const rooms =
        item.rooms ||
        item.features?.rooms ||
        item.properties?.rooms ||
        0;

      const bathrooms =
        item.bathrooms ||
        item.features?.bathrooms ||
        item.properties?.bathrooms ||
        0;

      const area =
        item.surface?.value ||
        item.surface ||
        item.area ||
        item.features?.surface ||
        item.properties?.surface ||
        0;
      const areaNum = typeof area === "number" ? area : Number(String(area).replace(/[^0-9]/g, "")) || 0;

      // Images — try different structures
      let images = [];
      if (item.images && Array.isArray(item.images)) {
        images = item.images.map(i => (typeof i === "string" ? i : i.url || i.uri || i.src || "")).filter(Boolean);
      } else if (item.multimedia?.photos) {
        images = item.multimedia.photos.map(p => p.url || p.uri || "").filter(Boolean);
      } else if (item.photo) {
        const photoUrl = typeof item.photo === "string" ? item.photo : item.photo.url || item.photo.uri || "";
        if (photoUrl) images = [photoUrl];
      } else if (item.image) {
        const imgUrl = typeof item.image === "string" ? item.image : item.image.url || item.image.uri || "";
        if (imgUrl) images = [imgUrl];
      }

      const latitude =
        item.location?.latitude ||
        item.location?.coordinates?.latitude ||
        item.geo?.lat ||
        item.latitude ||
        0;

      const longitude =
        item.location?.longitude ||
        item.location?.coordinates?.longitude ||
        item.geo?.lng ||
        item.longitude ||
        0;

      const description =
        item.description?.text ||
        item.description?.value ||
        (typeof item.description === "string" ? item.description : "") ||
        "";

      const agency =
        item.agency?.name ||
        item.advertiser?.name ||
        item.agent?.name ||
        "";

      const detailUrl =
        item.url ||
        item.seoUrl ||
        item.link ||
        "";

      listings.push({
        id,
        price: priceNum,
        address: typeof address === "string" ? address : "",
        propertyType: typeof propertyType === "string" ? propertyType : "",
        rooms: Number(rooms) || 0,
        bathrooms: Number(bathrooms) || 0,
        area: areaNum,
        description: typeof description === "string" ? description.slice(0, 2000) : "",
        images,
        latitude: Number(latitude) || 0,
        longitude: Number(longitude) || 0,
        agency,
        detailUrl,
      });
    }
  } catch (e) {
    console.error(`  __NEXT_DATA__ parse error: ${e.message}`);
  }
  return listings;
}

// ===== Fallback: extract from DOM =====
async function extractFromDOM(page) {
  return await page.evaluate(() => {
    const results = [];
    // Try common Casa.it listing card selectors
    const cards = document.querySelectorAll(
      "[data-testid='listing-card'], .listing-card, .search-list__item, article[class*='listing'], [class*='RealEstateCard'], [class*='adItem'], [class*='result-item']"
    );

    cards.forEach(el => {
      const link = el.querySelector("a[href*='/annunci/'], a[href*='/dettaglio/'], a[href]");
      const href = link ? link.href : "";
      const idMatch = href.match(/\/(\d+)\/?(?:\?|$)/) || href.match(/[-_](\d+)(?:\.html)?/);
      const id = idMatch ? idMatch[1] : "";
      if (!id) return;

      const priceEl = el.querySelector("[class*='price'], [class*='Price'], [class*='prezzo']");
      const priceText = priceEl ? priceEl.textContent.trim() : "0";
      const price = Number(priceText.replace(/[^0-9]/g, "")) || 0;

      const titleEl = el.querySelector("[class*='title'], [class*='Title'], h2, h3");
      const title = titleEl ? titleEl.textContent.trim() : "";

      const addressEl = el.querySelector("[class*='address'], [class*='Address'], [class*='location'], [class*='zona']");
      const address = addressEl ? addressEl.textContent.trim() : title;

      const imgEl = el.querySelector("img[src*='http'], img[data-src*='http']");
      const imgSrc = imgEl ? (imgEl.src || imgEl.dataset.src || "") : "";

      results.push({
        id,
        price,
        address,
        propertyType: "",
        rooms: 0,
        bathrooms: 0,
        area: 0,
        description: "",
        images: imgSrc ? [imgSrc] : [],
        latitude: 0,
        longitude: 0,
        agency: "",
        detailUrl: href,
      });
    });

    return results;
  });
}

// ===== Insert property =====
async function insertProperty(prop, listingType, cityName, r2Images) {
  const casaId = String(prop.id);
  const slug = slugify(prop.address || `immobile-${casaId}`) + `-casa${casaId}`;

  const { data: dup } = await sb.from("properties").select("id").eq("slug", slug).maybeSingle();
  if (dup) return { skipped: true };

  const addressStr = prop.address || "";
  const parts = addressStr.split(",").map(s => s.trim());
  const city = parts.length > 1 ? parts[parts.length - 1] : cityName;
  const district = parts.length > 1 ? parts[0] : "";

  const property = {
    slug,
    title: `${prop.propertyType || "Immobile"} - ${prop.address || cityName}`,
    listing_type: listingType,
    category: mapCategory(prop.propertyType),
    subtype: "ostatni",
    rooms_label: prop.rooms ? `${prop.rooms} locali` : "",
    price: prop.price || 0,
    price_currency: "eur",
    price_unit: listingType === "rent" ? "za_mesic" : undefined,
    city,
    district,
    location_label: prop.address || cityName,
    latitude: prop.latitude || 0,
    longitude: prop.longitude || 0,
    area: prop.area || 0,
    summary: (prop.description || prop.address || "").slice(0, 300),
    description: prop.description || undefined,
    image_src: r2Images[0] || "/branding/placeholder.png",
    image_alt: prop.address || `Immobile a ${cityName}`,
    images: r2Images,
    featured: false,
    active: true,
    source: "casa.it",
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
  Casa.it Scraper (Playwright) | Pages: ${PAGES} | Delay: ${DELAY_MS}ms
  Cities: ${CITIES.map(c => c.name).join(", ")}
`);

  const state = loadState();
  const t0 = Date.now();

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: UA,
    viewport: { width: 1920, height: 1080 },
    locale: "it-IT",
    extraHTTPHeaders: {
      "Accept-Language": "it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7",
    },
  });

  const page = await context.newPage();

  // Initial visit to handle cookies
  console.log("  Opening Casa.it...");
  try {
    await page.goto("https://www.casa.it", { waitUntil: "domcontentloaded", timeout: 30000 });
    await sleep(3000);

    // Accept cookie consent
    try {
      const cookieBtn = page.locator(
        "button:has-text('Accetta'), button:has-text('accetta'), button:has-text('Accept'), " +
        "button:has-text('Accetto'), button:has-text('OK'), button:has-text('Continua'), " +
        "#onetrust-accept-btn-handler, [id*='accept'], [class*='accept'], " +
        "button[data-testid='cookie-accept'], [class*='cookie'] button"
      );
      if (await cookieBtn.first().isVisible({ timeout: 5000 })) {
        await cookieBtn.first().click();
        console.log("  Cookie consent accepted");
        await sleep(1500);
      }
    } catch {}
  } catch (e) {
    console.warn(`  Initial page load issue: ${e.message} (continuing...)`);
  }

  for (const city of CITIES) {
    for (const ch of CHANNELS) {
      const label = `${city.name} - ${ch.type === "sale" ? "Vendita" : "Affitto"}`;
      console.log(`\n== ${label} ==`);

      for (let p = 1; p <= PAGES; p++) {
        const url = `https://www.casa.it/${ch.pathPrefix}/${city.slug}/?page=${p}`;
        console.log(`  Page ${p}: ${url}`);

        await sleep(DELAY_MS + Math.random() * 2000);

        try {
          await page.goto(url, { waitUntil: "load", timeout: 30000 });
          await sleep(3000);
        } catch (e) {
          console.error(`  Nav error: ${e.message}`);
          continue;
        }

        // Try to accept cookie consent again if it reappears
        try {
          const cookieBtn = page.locator(
            "button:has-text('Accetta'), button:has-text('Accept'), #onetrust-accept-btn-handler"
          );
          if (await cookieBtn.first().isVisible({ timeout: 1000 })) {
            await cookieBtn.first().click();
            await sleep(1000);
          }
        } catch {}

        // Method 1: Extract __NEXT_DATA__
        let listings = [];
        try {
          const nextDataRaw = await page.evaluate(() => {
            const el = document.querySelector("script#__NEXT_DATA__");
            return el ? el.textContent : null;
          });

          if (nextDataRaw) {
            const nextData = JSON.parse(nextDataRaw);
            listings = parseNextDataListings(nextData);
            if (listings.length > 0) {
              console.log(`  __NEXT_DATA__: ${listings.length} listings found`);
            }
          }
        } catch (e) {
          console.warn(`  __NEXT_DATA__ extraction failed: ${e.message}`);
        }

        // Method 2: Fallback to DOM extraction
        if (listings.length === 0) {
          listings = await extractFromDOM(page);
          if (listings.length > 0) {
            console.log(`  DOM fallback: ${listings.length} listings found`);
          }
        }

        if (listings.length === 0) {
          console.log(`  Page ${p}: no listings found, stopping pagination for this city/channel`);
          break;
        }

        for (const prop of listings) {
          const casaId = String(prop.id);
          if (!casaId || state.seen[`casa-${casaId}`]) { process.stdout.write("s"); continue; }

          try {
            // Upload images to R2
            const r2Urls = [];
            for (const imgUrl of (prop.images || []).slice(0, MAX_IMAGES)) {
              if (!imgUrl || imgUrl.startsWith("data:")) continue;
              const fullUrl = imgUrl.startsWith("http") ? imgUrl : `https:${imgUrl}`;
              const uploaded = await uploadToR2(fullUrl, slugify(prop.address || casaId));
              if (uploaded) { r2Urls.push(uploaded); state.stats.images++; }
            }

            const res = await insertProperty(prop, ch.type, city.name, r2Urls);
            if (res.skipped) { state.stats.skipped++; process.stdout.write("d"); }
            else { state.stats.properties++; process.stdout.write("."); }

            state.seen[`casa-${casaId}`] = true;
            if (state.stats.properties % 5 === 0) saveState(state);
          } catch (e) {
            state.stats.errors++;
            console.error(`\n  Err ${casaId}: ${e.message}`);
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
