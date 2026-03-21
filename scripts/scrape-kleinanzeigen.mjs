#!/usr/bin/env node
// ============================================================
// Kleinanzeigen.de Scraper — German Real Estate
// No anti-bot protection, server-side rendered HTML
// Usage: node scripts/scrape-kleinanzeigen.mjs [--pages 10] [--delay 3000]
// ============================================================

import { createClient } from "@supabase/supabase-js";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { readFileSync, existsSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import * as cheerio from "cheerio";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// ===== Config =====
const args = process.argv.slice(2);
function getArg(name, def) {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
}

const PAGES = Number(getArg("--pages", "10"));
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
if (!r2) console.warn("WARNING: R2 not configured — images skipped");

// ===== State =====
const STATE_FILE = resolve(ROOT, "scripts/.scrape-state-kleinanzeigen.json");
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

async function fetchPage(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      "Accept": "text/html,application/xhtml+xml",
      "Accept-Language": "de-DE,de;q=0.9,en;q=0.5",
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
    const ext = "jpg";
    const key = `properties/${slug}/${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`;
    await r2.send(new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: buf,
      ContentType: resp.headers.get("content-type") || "image/jpeg",
    }));
    return `${R2_PUBLIC_URL}/${key}`;
  } catch { return null; }
}

// ===== Geocode fallback =====
const geoCache = new Map();
async function geocodeCity(city) {
  if (geoCache.has(city)) return geoCache.get(city);
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city + ", Deutschland")}&format=json&limit=1`;
    const res = await fetch(url, { headers: { "User-Agent": "Nemovizor/1.0" }, signal: AbortSignal.timeout(5000) });
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

// ===== Parse listing from search page =====
function parseListings(html) {
  const $ = cheerio.load(html);
  const listings = [];

  $("article.aditem, .ad-listitem article").each((_, el) => {
    const $el = $(el);
    const linkEl = $el.find("a[href*='/s-anzeige/']").first();
    const href = linkEl.attr("href") || "";
    const idMatch = href.match(/\/(\d+)-/);
    if (!idMatch) return;

    const id = idMatch[1];
    const title = $el.find("h2 a, a.ellipsis").first().text().trim() ||
                  linkEl.attr("title") || linkEl.text().trim();

    // Price
    const priceText = $el.find(".aditem-main--middle--price-shipping--price, .aditem-price, [class*='price']").first().text().trim();
    const priceMatch = priceText.replace(/\./g, "").match(/([\d,]+)\s*\u20AC/);
    const price = priceMatch ? parseInt(priceMatch[1].replace(",", ""), 10) : 0;

    // Details (size, rooms)
    const detailText = $el.find(".aditem-main--middle--description, .aditem-details, [class*='detail']").text();
    const sizeMatch = detailText.match(/([\d,.]+)\s*m/);
    const roomsMatch = detailText.match(/([\d,.]+)\s*Zi/);
    const area = sizeMatch ? parseFloat(sizeMatch[1].replace(",", ".")) : 0;
    const roomsLabel = roomsMatch ? roomsMatch[1].replace(",", ".") : "";

    // Location
    const locationText = $el.find(".aditem-main--top--left, [class*='location']").text().trim();
    const zipMatch = locationText.match(/(\d{5})\s*(.*)/);
    const zip = zipMatch ? zipMatch[1] : "";
    const district = zipMatch ? zipMatch[2].trim() : locationText;

    // Image
    const imgEl = $el.find("img[src*='kleinanzeigen'], img[data-src*='kleinanzeigen']").first();
    const imgSrc = imgEl.attr("src") || imgEl.attr("data-src") || "";
    // Get higher res version
    const imgHiRes = imgSrc.replace(/\$_\d+\./, "$_57.").replace(/rule=[^&]+/, "rule=$_57.AUTO");

    listings.push({ id, title, price, area, roomsLabel, zip, district, href, imgSrc: imgHiRes });
  });

  return listings;
}

// ===== Fetch detail page for more info =====
async function fetchDetail(href) {
  try {
    const url = `https://www.kleinanzeigen.de${href}`;
    const html = await fetchPage(url);
    const $ = cheerio.load(html);

    const description = $("#viewad-description-text, .viewad-description").text().trim().slice(0, 2000);

    // Images
    const images = [];
    $("[data-imgsrc], .galleryimage-element img, #viewad-image img").each((_, img) => {
      const src = $(img).attr("data-imgsrc") || $(img).attr("src") || "";
      if (src && images.length < MAX_IMAGES) {
        images.push(src.replace(/\$_\d+\./, "$_57.").replace(/rule=[^&]+/, "rule=$_57.AUTO"));
      }
    });

    // JSON-LD
    let latitude = 0, longitude = 0;
    $('script[type="application/ld+json"]').each((_, s) => {
      try {
        const ld = JSON.parse($(s).html());
        if (ld.geo) {
          latitude = parseFloat(ld.geo.latitude) || 0;
          longitude = parseFloat(ld.geo.longitude) || 0;
        }
        if (ld.address?.geo) {
          latitude = parseFloat(ld.address.geo.latitude) || 0;
          longitude = parseFloat(ld.address.geo.longitude) || 0;
        }
      } catch {}
    });

    // Location from breadcrumb or viewad
    const locationFull = $(".viewad-locality, #viewad-locality").text().trim();

    return { description, images, latitude, longitude, locationFull };
  } catch (e) {
    return { description: "", images: [], latitude: 0, longitude: 0, locationFull: "" };
  }
}

// ===== Search configs =====
const CATEGORIES = [
  // Apartments for sale
  { path: "wohnung-kaufen", code: "c196", listingType: "sale", category: "apartment" },
  // Houses for sale
  { path: "haus-kaufen", code: "c208", listingType: "sale", category: "house" },
  // Apartments for rent
  { path: "mietwohnungen", code: "c203", listingType: "rent", category: "apartment" },
  // Houses for rent
  { path: "haeuser-zur-miete", code: "c205", listingType: "rent", category: "house" },
];

const CITIES = [
  { name: "Berlin", loc: "l3331" },
  { name: "M\u00fcnchen", loc: "l6411" },
  { name: "Hamburg", loc: "l9409" },
  { name: "K\u00f6ln", loc: "l945" },
  { name: "Frankfurt", loc: "l4292" },
  { name: "D\u00fcsseldorf", loc: "l2068" },
  { name: "Stuttgart", loc: "l8100" },
  { name: "Leipzig", loc: "l3826" },
  { name: "Dresden", loc: "l3820" },
  { name: "N\u00fcrnberg", loc: "l5529" },
  { name: "Hannover", loc: "l2448" },
  { name: "Bremen", loc: "l1" },
  { name: "Essen", loc: "l954" },
  { name: "Dortmund", loc: "l950" },
  { name: "Bonn", loc: "l930" },
];

// ===== Main =====
async function main() {
  const t0 = Date.now();
  const state = loadState();
  let totalProps = 0, totalImages = 0, totalSkipped = 0, totalErrors = 0;

  console.log(`\n  Kleinanzeigen.de Scraper | Pages: ${PAGES} | Delay: ${DELAY_MS}ms`);
  console.log(`  Cities: ${CITIES.map(c => c.name).join(", ")}\n`);

  for (const cat of CATEGORIES) {
    for (const city of CITIES) {
      console.log(`\n== ${city.name} ${cat.path} ==`);

      for (let page = 1; page <= PAGES; page++) {
        try {
          const url = `https://www.kleinanzeigen.de/s-${cat.path}/${city.name.toLowerCase()}/seite:${page}/${cat.code}${city.loc}`;
          const html = await fetchPage(url);
          const listings = parseListings(html);

          if (!listings.length) {
            console.log(`  Page ${page}: empty, stopping city`);
            break;
          }

          let inserted = 0, skipped = 0;
          for (const listing of listings) {
            const stateKey = `ka-${listing.id}`;
            if (state.seen[stateKey]) { skipped++; totalSkipped++; continue; }

            try {
              // Fetch detail for description + images + coords
              const detail = await fetchDetail(listing.href);
              await sleep(500); // Be gentle

              const slug = slugify(listing.title || `wohnung-${listing.id}`) + `-ka${listing.id}`;

              // Check for duplicate
              const { data: dup } = await sb.from("properties").select("id").eq("slug", slug).maybeSingle();
              if (dup) { state.seen[stateKey] = true; skipped++; totalSkipped++; continue; }

              // Geocode if no coords from detail page
              let lat = detail.latitude, lon = detail.longitude;
              if (!lat || !lon) {
                const geo = await geocodeCity(listing.district || city.name);
                if (geo) { lat = geo.lat; lon = geo.lon; }
              }

              // Upload images to R2
              const allImages = detail.images.length ? detail.images : (listing.imgSrc ? [listing.imgSrc] : []);
              const r2Images = [];
              for (const imgUrl of allImages.slice(0, MAX_IMAGES)) {
                const r2Url = await uploadToR2(imgUrl, slug);
                if (r2Url) { r2Images.push(r2Url); totalImages++; }
              }

              const locationParts = [listing.district, city.name].filter(Boolean);
              const property = {
                slug,
                title: listing.title || `Immobilie in ${city.name}`,
                listing_type: cat.listingType,
                category: cat.category,
                subtype: "ostatni",
                rooms_label: listing.roomsLabel ? `${listing.roomsLabel} Zi.` : "",
                price: listing.price,
                price_currency: "eur",
                city: city.name,
                district: listing.district,
                zip: listing.zip,
                region: "",
                location_label: locationParts.join(", "),
                latitude: lat,
                longitude: lon,
                area: listing.area || 0,
                summary: (listing.title || "").slice(0, 300),
                description: detail.description || undefined,
                image_src: r2Images[0] || (listing.imgSrc || "/branding/placeholder.png"),
                image_alt: listing.title || `Immobilie in ${city.name}`,
                images: r2Images.length ? r2Images : (listing.imgSrc ? [listing.imgSrc] : []),
                featured: false,
                active: true,
                source: "kleinanzeigen",
                country: "de",
              };

              const { error } = await sb.from("properties").insert(property);
              if (error) {
                if (error.code === "23505") { skipped++; totalSkipped++; }
                else { console.error(`  Err ${listing.id}: ${error.message}`); totalErrors++; }
              } else {
                inserted++;
                totalProps++;
                process.stdout.write(".");
              }

              state.seen[stateKey] = true;
            } catch (e) {
              console.error(`  Err ${listing.id}: ${e.message}`);
              totalErrors++;
            }
          }

          if (skipped > 0) process.stdout.write(`s${skipped}`);
          console.log(`\n  Page ${page}: +${inserted} (${skipped} skipped)`);

          saveState(state);
          await sleep(DELAY_MS);
        } catch (e) {
          console.error(`  Page ${page} error: ${e.message}`);
          totalErrors++;
          break;
        }
      }
    }
  }

  const elapsed = ((Date.now() - t0) / 60000).toFixed(1);
  console.log(`\n  DONE in ${elapsed}m | Properties: ${totalProps} | Images: ${totalImages} | Skipped: ${totalSkipped} | Errors: ${totalErrors}\n`);

  state.stats = { properties: totalProps, images: totalImages, skipped: totalSkipped, errors: totalErrors, lastRun: new Date().toISOString() };
  saveState(state);
}

main().catch(e => { console.error("FATAL:", e); process.exit(1); });
