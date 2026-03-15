#!/usr/bin/env node
// ============================================================
// Sreality Full Scraper v3
// Properties + Agencies + Brokers + R2 images
// Extracts ALL available info: 3D, video, boolean features, areas, etc.
// Direct R2 upload (no dev server needed)
// Usage: node scripts/scrape-sreality.mjs [--pages 50] [--delay 300]
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

const PAGES = Number(getArg("--pages", "50"));
const DELAY_MS = Number(getArg("--delay", "300"));
const PER_PAGE = 20;
const MAX_IMAGES = 8;
const IMG_CONCURRENCY = 4; // parallel image downloads
const SREALITY = "https://www.sreality.cz/api/cs/v2";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";

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
const isForeign = process.argv.includes("--foreign");
const STATE_FILE = resolve(ROOT, isForeign ? "scripts/.scrape-state-foreign.json" : "scripts/.scrape-state.json");
function loadState() {
  try { return JSON.parse(readFileSync(STATE_FILE, "utf8")); }
  catch { return { seen: {}, stats: { properties: 0, agencies: 0, brokers: 0, images: 0, skipped: 0 } }; }
}
function saveState(state) { writeFileSync(STATE_FILE, JSON.stringify(state, null, 2)); }

// ===== Maps =====
const CATEGORY_MAP = { 1: "apartment", 2: "house", 3: "land", 4: "commercial", 5: "other" };
const TYPE_MAP = { 1: "sale", 2: "rent", 3: "auction" };
const SUBTYPE_APT = { 2: "1+kk", 3: "1+1", 4: "2+kk", 5: "2+1", 6: "3+kk", 7: "3+1", 8: "4+kk", 9: "4+1", 10: "5+kk", 11: "5+1", 12: "6+", 16: "atypicky", 47: "pokoj" };
const SUBTYPE_HOUSE = { 37: "rodinny", 39: "vila", 43: "chalupa", 44: "chata", 33: "zemedelska_usedlost", 34: "pamatka", 35: "na_klic", 36: "vicegeneracni" };
const SUBTYPE_LAND = { 19: "bydleni", 18: "komercni", 20: "pole", 22: "lesy", 21: "louky", 23: "zahrady", 24: "rybniky", 48: "sady_vinice", 25: "ostatni" };
const SUBTYPE_COM = { 26: "kancelare", 27: "sklady", 28: "vyroba", 29: "obchodni_prostory", 30: "ubytovani", 31: "restaurace", 32: "zemedelsky", 38: "cinzovni_dum", 46: "virtualni_kancelar", 40: "ordinace", 41: "apartmany", 42: "ostatni" };
const SUBTYPE_OTHER = { 52: "garaz", 53: "vinny_sklep", 55: "pudni_prostor", 56: "garazove_stani", 57: "mobilheim", 50: "ostatni" };
function getSubtype(cat, sub) {
  if (cat === 1) return SUBTYPE_APT[sub] || "atypicky";
  if (cat === 2) return SUBTYPE_HOUSE[sub] || "rodinny";
  if (cat === 3) return SUBTYPE_LAND[sub] || "ostatni";
  if (cat === 4) return SUBTYPE_COM[sub] || "kancelare";
  if (cat === 5) return SUBTYPE_OTHER[sub] || "ostatni";
  return "ostatni";
}

const COND = { "Velmi dobrý": "velmi_dobry", "Dobrý": "dobry", "Špatný": "spatny", "Novostavba": "novostavba", "Po rekonstrukci": "po_rekonstrukci", "Před rekonstrukcí": "pred_rekonstrukci", "Ve výstavbě": "ve_vystavbe", "Projekt": "projekt", "K demolici": "k_demolici", "V rekonstrukci": "v_rekonstrukci" };
const OWN = { "Osobní": "osobni", "Družstevní": "druzstevni", "Státní / obecní": "statni" };
const FURN = { "Vybavený": "ano", "Nevybavený": "ne", "Částečně": "castecne", "Částečně vybavený": "castecne" };
const ENERGY = { "Mimořádně úsporná": "A", "Velmi úsporná": "B", "Úsporná": "C", "Méně úsporná": "D", "Nehospodárná": "E", "Velmi nehospodárná": "F", "Mimořádně nehospodárná": "G" };
const MATERIAL = { "Dřevostavba": "drevostavba", "Cihlová": "cihla", "Kamenná": "kamen", "Montovaná": "montovana", "Panelová": "panel", "Skeletová": "skeletal", "Smíšená": "smisena" };

function slugify(t) {
  return t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
}
function getItem(items, name) { return items.find(i => i.name === name)?.value ?? null; }
function getItemBool(items, name) { const v = getItem(items, name); return v === true || v === "Ano" || v === 1; }
function getItemNum(items, name) { const v = Number(getItem(items, name)); return isNaN(v) ? undefined : v || undefined; }
async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchS(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(15000) });
      if (r.status === 429) { console.log(" [429 wait 10s]"); await sleep(10000); continue; }
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    } catch (e) {
      if (i === retries - 1) throw e;
      await sleep(1000 * (i + 1));
    }
  }
}

// ===== R2 Upload =====
async function uploadToR2(imageUrl, slug) {
  if (!r2) return null;
  try {
    const resp = await fetch(imageUrl, {
      headers: { "User-Agent": UA, "Referer": "https://www.sreality.cz/" },
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

// ===== Agency Upsert =====
const agencyCache = new Map();
async function upsertAgency(premise) {
  if (!premise?.id) return null;
  const pid = String(premise.id);
  if (agencyCache.has(pid)) return agencyCache.get(pid);

  const agencyName = premise.ask?.name || premise.address?.split(",")[0] || "";
  const slug = slugify(agencyName || `agency-${pid}`) + `-sr${pid}`;

  const { data: existing } = await sb.from("agencies").select("id").eq("slug", slug).maybeSingle();
  if (existing) { agencyCache.set(pid, existing.id); return existing.id; }

  // Logo
  let logoUrl = null;
  if (premise.logo) logoUrl = await uploadToR2(premise.logo, `agency-${slugify(agencyName || pid)}`);

  const ask = premise.ask || {};
  const phone = premise.phones?.[0] ? `+${premise.phones[0].code}${premise.phones[0].number}` : "";

  const { data, error } = await sb.from("agencies").insert({
    name: agencyName || `Realitka ${pid}`, slug,
    logo: logoUrl || premise.logo_small || null,
    description: (premise.description || ask.description || "").slice(0, 2000),
    phone, email: premise.email || ask.email || "",
    website: premise.www || null,
    seat_city: ask.addr_city || "", seat_address: premise.address || "",
    total_listings: 0, total_brokers: 0, rating: 0,
  }).select("id").single();

  if (error) {
    const { data: fb } = await sb.from("agencies").select("id").eq("slug", slug).maybeSingle();
    if (fb) { agencyCache.set(pid, fb.id); return fb.id; }
    return null;
  }
  agencyCache.set(pid, data.id);
  return data.id;
}

// ===== Broker Upsert =====
const brokerCache = new Map();
async function upsertBroker(seller, agencyId) {
  if (!seller?.user_id) return null;
  const uid = String(seller.user_id);
  if (brokerCache.has(uid)) return brokerCache.get(uid);

  const name = seller.user_name || `Makler ${uid}`;
  const slug = slugify(name) + `-sr${uid}`;

  const { data: existing } = await sb.from("brokers").select("id").eq("slug", slug).maybeSingle();
  if (existing) { brokerCache.set(uid, existing.id); return existing.id; }

  // Photo — use view URL (smaller, reliable)
  let photoUrl = null;
  if (seller.image) {
    const src = seller.image.includes("?") ? seller.image : seller.image + "?fl=res,200,200,3|shr,,20|jpg,90";
    photoUrl = await uploadToR2(src, `broker-${slugify(name)}`);
  }

  const mob = seller.phones?.find(p => p.type === "MOB") || seller.phones?.[0];
  const premise = seller._embedded?.premise;

  const { data, error } = await sb.from("brokers").insert({
    name, slug,
    phone: mob ? `+${mob.code}${mob.number}` : "",
    email: seller.email || "",
    photo: photoUrl || seller.image || null,
    agency_name: premise?.ask?.name || premise?.address?.split(",")[0] || "",
    agency_id: agencyId || null,
    specialization: "", active_listings: 0, rating: 0, total_deals: 0, bio: "",
  }).select("id").single();

  if (error) {
    const { data: fb } = await sb.from("brokers").select("id").eq("slug", slug).maybeSingle();
    if (fb) { brokerCache.set(uid, fb.id); return fb.id; }
    return null;
  }
  brokerCache.set(uid, data.id);
  return data.id;
}

// ===== Property Insert =====
async function insertProperty(detail, r2Images, brokerId) {
  const seo = detail.seo || {};
  const items = detail.items || [];
  const map = detail.map || {};
  const mainCat = seo.category_main_cb || 1;
  const typeCb = seo.category_type_cb || 1;
  const subCb = seo.category_sub_cb || 2;
  const hashId = detail.hash_id;

  const name = detail.name?.value || "Nemovitost";
  const locality = detail.locality?.value || "";
  const parts = locality.split(",").map(s => s.trim());
  const lastPart = parts[parts.length - 1] || "";

  // Detect foreign country from locality (e.g. "Bergstraße, Treffen, Rakousko")
  const COUNTRY_MAP = {
    "Rakousko": "at", "Chorvatsko": "hr", "Bulharsko": "bg",
    "Albánie": "al", "Kypr": "cy", "Francie": "fr",
    "Španělsko": "es", "Itálie": "it", "Řecko": "gr",
    "Slovensko": "sk", "Německo": "de", "Maďarsko": "hu",
    "Portugalsko": "pt", "Černá Hora": "me", "Turecko": "tr",
  };
  const detectedCountry = COUNTRY_MAP[lastPart] || null;
  const city = detectedCountry ? (parts.length > 2 ? parts[parts.length - 2] : parts[0]) : (lastPart || "Praha");
  const district = parts.length > 1 ? parts[0] : city;
  const slug = slugify(name + "-" + city) + `-sr${hashId}`;

  // Dedup check
  const { data: dup } = await sb.from("properties").select("id").eq("slug", slug).maybeSingle();
  if (dup) return { skipped: true, slug };

  const description = detail.text?.value || "";
  const area = getItemNum(items, "Užitná ploch") || getItemNum(items, "Plocha zastavěná") || getItemNum(items, "Celková plocha") || 1;
  const landArea = getItemNum(items, "Plocha pozemku");
  const condRaw = getItem(items, "Stav objektu");
  const ownRaw = getItem(items, "Vlastnictví");
  const furnRaw = getItem(items, "Vybavení");
  const energyRaw = getItem(items, "Energetická náročnost budovy");
  const materialRaw = getItem(items, "Stavba");

  // Floor parsing
  let floor, totalFloors;
  const floorRaw = getItem(items, "Podlaží");
  if (typeof floorRaw === "string") {
    const m = floorRaw.match(/(\d+)\.\s*podlaží\s*z\s*celkem\s*(\d+)/i);
    if (m) { floor = +m[1]; totalFloors = +m[2]; }
  }

  // Boolean features from labels
  const allLabels = (detail.labelsReleased?.[0] || []).concat(detail.labelsReleased?.[1] || []);
  const hasLabel = (l) => allLabels.includes(l);

  // 3D / Video / Panorama
  const has3D = detail.has_panorama === 1 || detail.has_panorama === true;
  const hasVideo = detail.has_video === true;
  // Matterport URL — sometimes in items or in additional links
  let matterportUrl = null;
  if (has3D) {
    // Check for matterport in recommendations or items
    const vrItem = getItem(items, "Virtuální prohlídka");
    if (typeof vrItem === "string" && vrItem.includes("http")) matterportUrl = vrItem;
    // Also check _embedded for panorama link
    const panoLinks = detail._embedded?.panoramas || detail._links?.panorama;
    if (panoLinks?.href) matterportUrl = panoLinks.href;
  }

  const property = {
    slug, title: name,
    listing_type: TYPE_MAP[typeCb] || "sale",
    category: CATEGORY_MAP[mainCat] || "apartment",
    subtype: getSubtype(mainCat, subCb),
    rooms_label: mainCat === 1 ? (SUBTYPE_APT[subCb] || "atypicky") : getSubtype(mainCat, subCb),
    price: detail.price_czk?.value_raw || 0,
    price_unit: typeCb === 2 ? "za_mesic" : undefined,
    price_note: getItem(items, "Poznámka k ceně") || undefined,
    city, district, location_label: locality,
    latitude: map.lat || 50.08, longitude: map.lon || 14.42,
    area, land_area: landArea,
    summary: (description.slice(0, 300).replace(/\n/g, " ").trim()) || name,
    description: description || undefined,
    // Detailed fields
    condition: COND[condRaw] || undefined,
    ownership: OWN[ownRaw] || undefined,
    furnishing: FURN[furnRaw] || undefined,
    energy_rating: ENERGY[energyRaw] || undefined,
    building_material: MATERIAL[materialRaw] || undefined,
    floor, total_floors: totalFloors,
    // Areas
    balcony_area: getItemNum(items, "Balkón") || undefined,
    terrace_area: getItemNum(items, "Terasa") || undefined,
    garden_area: getItemNum(items, "Zahrada") || undefined,
    loggia_area: getItemNum(items, "Lodžie") || undefined,
    cellar_area: getItemNum(items, "Sklep") || undefined,
    // Booleans
    balcony: hasLabel("balcony") || getItemBool(items, "Balkón"),
    terrace: hasLabel("terrace") || getItemBool(items, "Terasa"),
    garden: hasLabel("garden") || getItemBool(items, "Zahrada"),
    elevator: hasLabel("elevator") || getItemBool(items, "Výtah"),
    cellar: hasLabel("cellar") || getItemBool(items, "Sklep"),
    garage: hasLabel("garage") || getItemBool(items, "Garáž"),
    pool: hasLabel("swimming_pool") || getItemBool(items, "Bazén"),
    loggia: hasLabel("loggia") || getItemBool(items, "Lodžie"),
    garage_count: getItemNum(items, "Garáž") || undefined,
    // 3D / Video
    matterport_url: matterportUrl || undefined,
    // Images - skip if no photos uploaded
    image_src: r2Images[0] || null,
    image_alt: name,
    images: r2Images,
    featured: false, active: true,
    broker_id: brokerId || null,
    source: "sreality",
    country: detectedCountry || "cz",
  };

  // Skip listings without photos
  if (!r2Images.length) return { skipped: true, slug };

  const { error } = await sb.from("properties").insert(property);
  if (error) {
    if (error.code === "23505") return { skipped: true, slug };
    throw new Error(error.message);
  }
  return { skipped: false, slug };
}

// ===== Main =====
async function main() {
  console.log(`
  Sreality Scraper v3 | Pages: ${PAGES} | Delay: ${DELAY_MS}ms | Max imgs: ${MAX_IMAGES}
  Target: ~${PAGES * PER_PAGE} properties
`);

  const state = loadState();
  const t0 = Date.now();

  const allCategories = [
    { cat: 1, type: 1, label: "Prodej bytu" },
    { cat: 1, type: 2, label: "Pronajem bytu" },
    { cat: 2, type: 1, label: "Prodej domu" },
    { cat: 2, type: 2, label: "Pronajem domu" },
    { cat: 3, type: 1, label: "Prodej pozemku" },
    { cat: 3, type: 2, label: "Pronajem pozemku" },
    { cat: 4, type: 1, label: "Prodej komercni" },
    { cat: 4, type: 2, label: "Pronajem komercni" },
    { cat: 5, type: 1, label: "Prodej ostatni" },
    { cat: 5, type: 2, label: "Pronajem ostatni" },
  ];
  const onlyCat = getArg("--only-cat", null);
  const categories = onlyCat ? allCategories.filter(c => c.cat === Number(onlyCat)) : allCategories;

  // Foreign countries support: --foreign scrapes listings from abroad
  const foreignMode = args.includes("--foreign");
  // Sreality country IDs: 8=Albania, 40=Austria, 100=Bulgaria, 191=Croatia, 196=Cyprus
  const FOREIGN_COUNTRIES = [
    { id: 40, code: "at", label: "Rakousko" },
    { id: 191, code: "hr", label: "Chorvatsko" },
    { id: 196, code: "cy", label: "Kypr" },
    { id: 100, code: "bg", label: "Bulharsko" },
    { id: 8, code: "al", label: "Albánie" },
    { id: 724, code: "es", label: "Španělsko" },
    { id: 380, code: "it", label: "Itálie" },
    { id: 300, code: "gr", label: "Řecko" },
    { id: 276, code: "de", label: "Německo" },
    { id: 250, code: "fr", label: "Francie" },
    { id: 703, code: "sk", label: "Slovensko" },
    { id: 499, code: "me", label: "Černá Hora" },
    { id: 792, code: "tr", label: "Turecko" },
    { id: 620, code: "pt", label: "Portugalsko" },
    { id: 348, code: "hu", label: "Maďarsko" },
  ];
  // Filter to specific country code(s) with --country es,it
  const onlyCountry = getArg("--country", null);
  const filteredCountries = onlyCountry
    ? FOREIGN_COUNTRIES.filter(c => onlyCountry.split(",").includes(c.code))
    : FOREIGN_COUNTRIES;
  // In foreign mode, iterate each country separately (multi-value country_id doesn't work)
  const countryIds = foreignMode ? filteredCountries.map(c => c.id) : [null];

  const ppc = Math.ceil(PAGES / (categories.length * countryIds.length));

  for (const countryId of countryIds) {
    const countryLabel = countryId ? FOREIGN_COUNTRIES.find(c => c.id === countryId)?.label : "";
    if (countryLabel) console.log(`\n>>> ${countryLabel} <<<`);

  for (const c of categories) {
    console.log(`\n== ${c.label}${countryLabel ? ` (${countryLabel})` : ""} (${ppc} pages) ==`);

    for (let page = 0; page < ppc; page++) {
      console.log(`\n  Page ${page + 1}/${ppc}`);

      let listings;
      const countryQ = countryId ? `&locality_country_id=${countryId}` : "";
      try {
        listings = (await fetchS(`${SREALITY}/estates?category_main_cb=${c.cat}&category_type_cb=${c.type}&per_page=${PER_PAGE}&page=${page}${countryQ}`))
          ?._embedded?.estates ?? [];
      } catch (e) {
        console.error(`  Page error: ${e.message}`);
        await sleep(2000);
        continue;
      }
      if (!listings.length) { console.log("  Empty, next cat"); break; }

      for (const est of listings) {
        const hid = est.hash_id;
        if (state.seen[`sr-${hid}`]) { process.stdout.write("s"); continue; }

        try {
          await sleep(DELAY_MS);
          const detail = await fetchS(`${SREALITY}/estates/${hid}`);
          if (!detail?.name) { process.stdout.write("?"); continue; }

          // Agency
          const premise = detail._embedded?.seller?._embedded?.premise;
          const agencyId = await upsertAgency(premise);

          // Broker
          const seller = detail._embedded?.seller;
          const brokerId = await upsertBroker(seller, agencyId);

          // Images — view URLs (749x562)
          const srImgs = detail._embedded?.images || [];
          const imgUrls = srImgs.slice(0, MAX_IMAGES)
            .map(img => img._links?.view?.href || img._links?.gallery?.href)
            .filter(Boolean);

          // Parallel image upload in batches
          const r2Urls = [];
          const imgSlug = slugify(detail.name?.value || "p");
          for (let i = 0; i < imgUrls.length; i += IMG_CONCURRENCY) {
            const batch = imgUrls.slice(i, i + IMG_CONCURRENCY);
            const results = await Promise.all(batch.map(u => uploadToR2(u, imgSlug)));
            for (const url of results) {
              if (url) { r2Urls.push(url); state.stats.images++; }
            }
          }

          // Property
          detail.hash_id = detail.hash_id || hid;
          const res = await insertProperty(detail, r2Urls, brokerId);
          if (res.skipped) { state.stats.skipped++; process.stdout.write("d"); }
          else { state.stats.properties++; process.stdout.write("."); }

          state.seen[`sr-${hid}`] = true;
          if (state.stats.properties % 5 === 0) saveState(state);
        } catch (e) {
          console.error(`\n  Err ${hid}: ${e.message}`);
          process.stdout.write("x");
        }
      }

      const min = ((Date.now() - t0) / 60000).toFixed(1);
      console.log(`\n  [${min}m] P:${state.stats.properties} A:${agencyCache.size} B:${brokerCache.size} I:${state.stats.images} S:${state.stats.skipped}`);
      saveState(state);
    }
  }
  } // end countryIds loop

  saveState(state);
  const totalMin = ((Date.now() - t0) / 60000).toFixed(1);
  console.log(`\n  DONE in ${totalMin}m | Props: ${state.stats.properties} | Agencies: ${agencyCache.size} | Brokers: ${brokerCache.size} | Images: ${state.stats.images}\n`);
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
