#!/usr/bin/env node
// ============================================================
// Import PTF Reality properties into Nemovizor
// Fetches active listings from PTF Reality API (JSON, no scraping)
// Downloads images -> uploads to R2 -> inserts into Supabase
//
// Usage:
//   node scripts/import-ptf-reality.mjs              # full import
//   node scripts/import-ptf-reality.mjs --dry-run    # preview only
//   node scripts/import-ptf-reality.mjs --limit 5    # limit properties
// ============================================================

import { createClient } from "@supabase/supabase-js";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// ===== Config =====
const PTF_API = "https://ptf-production.up.railway.app/api";
const PTF_TENANT = "ptf-reality";
const PTF_AGENCY_NAME = "PTF Reality";
const MAX_IMAGES = 10;
const IMG_CONCURRENCY = 3;

const args = process.argv.slice(2);
function getArg(name, def) {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
}
const DRY_RUN = args.includes("--dry-run");
const LIMIT = Number(getArg("--limit", "1000"));

// ===== Load .env.local =====
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
if (!r2) console.warn("WARNING: R2 not configured - images will use original URLs");

// ===== Helpers =====
function slugify(t) {
  return t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
}
async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ===== Mapping PTF -> Nemovizor =====
const TYPE_MAP = { prodej: "sale", pronajem: "rent" };
const CAT_MAP = { byt: "apartment", dum: "house", pozemek: "land", komercni: "commercial", garaz: "other", ostatni: "other" };

function mapDisposition(disp) {
  if (!disp) return "atypicky";
  // PTF: "1+kk", "2+1", etc - same as Nemovizor
  return disp;
}

function mapCondition(cond) {
  const m = {
    "novostavba": "novostavba", "velmi dobry": "velmi_dobry", "dobry": "dobry",
    "po rekonstrukci": "po_rekonstrukci", "pred rekonstrukci": "pred_rekonstrukci",
    "ve vystavbe": "ve_vystavbe", "projekt": "projekt",
  };
  return m[(cond || "").toLowerCase()] || undefined;
}

function mapOwnership(own) {
  const m = { "osobni": "osobni", "druzstevni": "druzstevni", "statni": "statni" };
  return m[(own || "").toLowerCase()] || undefined;
}

// ===== R2 Upload =====
async function uploadToR2(imageUrl, slug) {
  if (!r2) return imageUrl; // fallback: use original URL
  try {
    const resp = await fetch(imageUrl, { signal: AbortSignal.timeout(15000) });
    if (!resp.ok) return imageUrl;
    const buf = Buffer.from(await resp.arrayBuffer());
    if (buf.byteLength < 500) return imageUrl;

    const ext = imageUrl.match(/\.(jpg|jpeg|png|webp)/i)?.[1] || "jpg";
    const key = `uploads/images/ptf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${slug.slice(0, 40)}.${ext}`;
    await r2.send(new PutObjectCommand({
      Bucket: R2_BUCKET_NAME, Key: key, Body: buf,
      ContentType: `image/${ext === "jpg" ? "jpeg" : ext}`,
      CacheControl: "public, max-age=31536000, immutable",
    }));
    return R2_PUBLIC_URL ? `${R2_PUBLIC_URL}/${key}` : key;
  } catch (e) {
    console.warn(`  Image upload failed: ${e.message}`);
    return imageUrl;
  }
}

async function uploadImages(images, slug) {
  const urls = [];
  const toUpload = images.slice(0, MAX_IMAGES);

  for (let i = 0; i < toUpload.length; i += IMG_CONCURRENCY) {
    const batch = toUpload.slice(i, i + IMG_CONCURRENCY);
    const results = await Promise.all(
      batch.map(img => uploadToR2(img.url || img.url_thumbnail, slug))
    );
    urls.push(...results.filter(Boolean));
  }
  return urls;
}

// ===== Fetch from PTF API =====
async function fetchPTFProperties() {
  const allProperties = [];
  let page = 1;
  const perPage = 50;

  while (true) {
    const url = `${PTF_API}/properties?page=${page}&limit=${perPage}`;
    console.log(`  Fetching page ${page}...`);

    const resp = await fetch(url, {
      headers: {
        "X-Tenant-Slug": PTF_TENANT,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(30000),
    });

    if (!resp.ok) {
      console.error(`  API error: ${resp.status} ${resp.statusText}`);
      break;
    }

    const result = await resp.json();
    const { data, pagination } = result;

    if (!data || data.length === 0) break;
    allProperties.push(...data);

    console.log(`  Got ${data.length} properties (total: ${allProperties.length}/${pagination.total})`);

    if (allProperties.length >= pagination.total || allProperties.length >= LIMIT) break;
    page++;
    await sleep(200);
  }

  return allProperties.slice(0, LIMIT);
}

async function fetchPTFPropertyDetail(slugOrId) {
  const url = `${PTF_API}/properties/${slugOrId}`;
  const resp = await fetch(url, {
    headers: { "X-Tenant-Slug": PTF_TENANT },
    signal: AbortSignal.timeout(15000),
  });
  if (!resp.ok) return null;
  return resp.json();
}

// ===== Ensure PTF Agency & Broker exist =====
async function ensurePTFAgency() {
  const { data: existing } = await sb
    .from("agencies")
    .select("id")
    .eq("name", PTF_AGENCY_NAME)
    .maybeSingle();

  if (existing) return existing.id;

  // Agency should already exist from migration 013
  const { data: bySlug } = await sb
    .from("agencies")
    .select("id")
    .eq("slug", "ptf-reality")
    .maybeSingle();

  if (bySlug) return bySlug.id;

  console.warn("  PTF Reality agency not found in DB - creating...");
  const { data, error } = await sb.from("agencies").insert({
    name: PTF_AGENCY_NAME,
    slug: "ptf-reality",
    email: "info@ptf.cz",
    phone: "",
    description: "PTF Reality - realitni kancelar",
    total_brokers: 0, total_listings: 0, total_deals: 0, rating: 0,
  }).select("id").single();

  if (error) { console.error("  Cannot create agency:", error.message); return null; }
  return data.id;
}

async function ensureBroker(agent, agencyId) {
  if (!agent) return null;

  const name = `${agent.first_name || ""} ${agent.last_name || ""}`.trim();
  if (!name) return null;

  const slug = slugify(name) + "-ptf";

  const { data: existing } = await sb
    .from("brokers")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (existing) return existing.id;

  // Upload photo
  let photoUrl = agent.photo_url || null;
  if (photoUrl && r2) {
    photoUrl = await uploadToR2(photoUrl, `broker-${slugify(name)}`);
  }

  const { data, error } = await sb.from("brokers").insert({
    name, slug,
    phone: agent.phone || "",
    email: agent.email || "",
    photo: photoUrl,
    agency_name: PTF_AGENCY_NAME,
    agency_id: agencyId,
    specialization: "", active_listings: 0, rating: 0, total_deals: 0, bio: "",
  }).select("id").single();

  if (error) {
    const { data: fb } = await sb.from("brokers").select("id").eq("slug", slug).maybeSingle();
    return fb?.id || null;
  }
  return data.id;
}

// ===== Convert PTF Property -> Nemovizor =====
function convertProperty(ptf, r2Images, brokerId) {
  const title = ptf.title || "Nemovitost";
  const city = ptf.address_city || "Praha";
  const slug = slugify(title + "-" + city) + "-ptf";

  const features = ptf.features || {};

  return {
    slug,
    title,
    listing_type: TYPE_MAP[ptf.offer_type] || "sale",
    category: CAT_MAP[ptf.property_type] || "apartment",
    subtype: mapDisposition(ptf.disposition) || "atypicky",
    rooms_label: ptf.disposition || "atypicky",
    price: ptf.price || 0,
    price_unit: ptf.offer_type === "pronajem" ? "za_mesic" : undefined,
    city,
    district: ptf.address_district || city,
    street: ptf.address_street || undefined,
    zip: ptf.address_zip || undefined,
    location_label: [ptf.address_street, ptf.address_city].filter(Boolean).join(", "),
    latitude: ptf.gps_lat || 50.08,
    longitude: ptf.gps_lng || 14.42,
    area: ptf.area_usable || ptf.area_total || 1,
    land_area: ptf.area_land || undefined,
    built_up_area: ptf.area_built || undefined,
    garden_area: ptf.area_garden || undefined,
    balcony_area: ptf.area_balcony || undefined,
    summary: (ptf.description_short || title).slice(0, 300),
    description: ptf.description || ptf.description_short || undefined,
    condition: mapCondition(ptf.building_condition),
    ownership: mapOwnership(ptf.ownership_type),
    energy_rating: ptf.energy_class || undefined,
    floor: ptf.floor || undefined,
    total_floors: ptf.floors_total || undefined,
    // Boolean features
    balcony: features.balcony || false,
    terrace: features.terrace || false,
    garden: features.garden || false,
    elevator: features.elevator || false,
    cellar: features.cellar || false,
    garage: features.garage || false,
    pool: features.pool || false,
    loggia: features.loggia || false,
    parking: features.parking ? "garaz" : "zadne",
    // Images
    image_src: r2Images[0] || null,
    image_alt: title,
    images: r2Images,
    // Status
    featured: ptf.is_featured || false,
    active: true,
    broker_id: brokerId || null,
    source: "ptf-reality",
    country: "cz",
  };
}

// ===== Main =====
async function main() {
  console.log(`
  PTF Reality -> Nemovizor Import
  API: ${PTF_API}
  Tenant: ${PTF_TENANT}
  Max images: ${MAX_IMAGES}
  R2: ${r2 ? "configured" : "NOT configured (using original URLs)"}
  ${DRY_RUN ? "** DRY RUN **" : ""}
`);

  // 1. Ensure agency exists
  const agencyId = await ensurePTFAgency();
  if (!agencyId) { console.error("Cannot find/create PTF Reality agency"); process.exit(1); }
  console.log(`Agency: PTF Reality (${agencyId})\n`);

  // 2. Fetch all active properties from PTF API
  console.log("Fetching properties from PTF Reality API...");
  const ptfProperties = await fetchPTFProperties();
  console.log(`\nFound ${ptfProperties.length} active properties\n`);

  if (ptfProperties.length === 0) {
    console.log("No properties to import.");
    return;
  }

  // 3. Process each property
  const stats = { imported: 0, skipped: 0, errors: 0, images: 0 };
  const brokerCache = new Map();

  for (let i = 0; i < ptfProperties.length; i++) {
    const ptf = ptfProperties[i];
    const num = `[${i + 1}/${ptfProperties.length}]`;

    // Check if already exists
    const testSlug = slugify((ptf.title || "") + "-" + (ptf.address_city || "")) + "-ptf";
    const { data: existing } = await sb.from("properties").select("id").eq("slug", testSlug).maybeSingle();
    if (existing) {
      console.log(`${num} SKIP (exists): ${ptf.title}`);
      stats.skipped++;
      continue;
    }

    console.log(`${num} ${ptf.title || "?"} | ${ptf.address_city || "?"} | ${ptf.price ? ptf.price.toLocaleString() + " Kc" : "?"}`);

    if (DRY_RUN) {
      console.log(`  -> Would import (${(ptf.images || []).length} images)`);
      stats.imported++;
      continue;
    }

    try {
      // Fetch detail for full description
      const detail = await fetchPTFPropertyDetail(ptf.slug || ptf.id);
      const fullPtf = detail ? { ...ptf, ...detail } : ptf;

      // Ensure broker
      let brokerId = null;
      const agent = fullPtf.agent;
      if (agent) {
        const cacheKey = agent.id;
        if (brokerCache.has(cacheKey)) {
          brokerId = brokerCache.get(cacheKey);
        } else {
          brokerId = await ensureBroker(agent, agencyId);
          brokerCache.set(cacheKey, brokerId);
        }
      }

      // Upload images
      const images = fullPtf.images || [];
      const sortedImages = [...images].sort((a, b) => {
        if (a.is_main && !b.is_main) return -1;
        if (!a.is_main && b.is_main) return 1;
        return (a.sort_order || 0) - (b.sort_order || 0);
      });

      console.log(`  Uploading ${Math.min(sortedImages.length, MAX_IMAGES)} images...`);
      const r2Images = await uploadImages(sortedImages, testSlug);
      stats.images += r2Images.length;

      if (r2Images.length === 0) {
        console.log(`  SKIP: no images`);
        stats.skipped++;
        continue;
      }

      // Convert and insert
      const property = convertProperty(fullPtf, r2Images, brokerId);
      const { error } = await sb.from("properties").insert(property);

      if (error) {
        if (error.code === "23505") {
          console.log(`  SKIP (duplicate)`);
          stats.skipped++;
        } else {
          console.error(`  ERROR: ${error.message}`);
          stats.errors++;
        }
      } else {
        console.log(`  OK: ${property.slug} (${r2Images.length} imgs)`);
        stats.imported++;
      }

      await sleep(300); // rate limit
    } catch (e) {
      console.error(`  ERROR: ${e.message}`);
      stats.errors++;
    }
  }

  console.log(`
  ========== DONE ==========
  Imported:  ${stats.imported}
  Skipped:   ${stats.skipped}
  Errors:    ${stats.errors}
  Images:    ${stats.images}
  ===========================
`);
}

main().catch(e => { console.error(e); process.exit(1); });
