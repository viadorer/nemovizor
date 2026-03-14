#!/usr/bin/env node
// ============================================================
// Import nemovitosti ze Sreality.cz do Nemovizor DB + R2
// Usage: node scripts/import-sreality.mjs
// ============================================================

const API_BASE = "http://localhost:60608";
const SREALITY_API = "https://www.sreality.cz/api/cs/v2";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)";
const DELAY_MS = 2000; // 2s delay between requests to avoid IP blocking

// Mapping Sreality category codes to our enums
const CATEGORY_MAP = { 1: "apartment", 2: "house", 3: "land", 4: "commercial", 5: "other" };
const TYPE_MAP = { 1: "sale", 2: "rent", 3: "auction" };

const SUBTYPE_MAP_APARTMENT = {
  2: "1+kk", 3: "1+1", 4: "2+kk", 5: "2+1", 6: "3+kk", 7: "3+1",
  8: "4+kk", 9: "4+1", 10: "5+kk", 11: "5+1", 12: "6+", 16: "Atypicky",
};
const SUBTYPE_MAP_HOUSE = {
  37: "Rodinny", 39: "Vila", 43: "Chalupa", 44: "Chata",
  33: "Zemedelska usedlost", 35: "Na klic",
};
const SUBTYPE_MAP_LAND = {
  19: "Bydleni", 18: "Komercni", 20: "Pole", 22: "Lesy",
  21: "Louky", 23: "Zahrady", 25: "Ostatni",
};

function getSubtype(mainCat, subCb) {
  if (mainCat === 1) return SUBTYPE_MAP_APARTMENT[subCb] || "Atypicky";
  if (mainCat === 2) return SUBTYPE_MAP_HOUSE[subCb] || "Rodinny";
  if (mainCat === 3) return SUBTYPE_MAP_LAND[subCb] || "Ostatni";
  if (mainCat === 4) return "Kancelare";
  return "Ostatni";
}

function getRoomsLabel(mainCat, subCb) {
  if (mainCat === 1) return SUBTYPE_MAP_APARTMENT[subCb] || "Atypicky";
  return getSubtype(mainCat, subCb);
}

function slugify(text) {
  return text
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function getItemValue(items, name) {
  const item = items.find(i => i.name === name);
  return item?.value ?? null;
}

function getItemBool(items, name) {
  const v = getItemValue(items, name);
  if (v === true || v === "Ano" || v === 1) return true;
  if (v === false || v === "Ne" || v === 0) return false;
  return null;
}

const CONDITION_MAP = {
  "Velmi dobrý": "velmi_dobry", "Dobrý": "dobry", "Špatný": "spatny",
  "Ve výstavbě": "ve_vystavbe", "Projekt": "projekt", "Novostavba": "novostavba",
  "K demolici": "k_demolici", "Před rekonstrukcí": "pred_rekonstrukci",
  "Po rekonstrukci": "po_rekonstrukci", "V rekonstrukci": "v_rekonstrukci",
};

const OWNERSHIP_MAP = {
  "Osobní": "osobni", "Družstevní": "druzstevni", "Státní / obecní": "statni",
};

const FURNISHING_MAP = {
  "Vybavený": "ano", "Nevybavený": "ne", "Částečně": "castecne", "Částečně vybavený": "castecne",
};

const ENERGY_MAP = {
  "Mimořádně úsporná": "A", "Velmi úsporná": "B", "Úsporná": "C",
  "Méně úsporná": "D", "Nehospodárná": "E", "Velmi nehospodárná": "F",
  "Mimořádně nehospodárná": "G",
};

const PARKING_MAP = {
  "Garáž": "garaz", "Parkovací stání": "parkovaci_stani",
};

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function fetchSreality(url) {
  const resp = await fetch(url, { headers: { "User-Agent": UA } });
  if (!resp.ok) throw new Error(`Sreality ${resp.status}: ${url}`);
  return resp.json();
}

// Fetch listing IDs from Sreality
async function fetchListings(count = 35) {
  const perPage = 20;
  const pages = Math.ceil(count / perPage);
  const estates = [];

  // Mix: prodej bytu, prodej domu, pronajem bytu
  const queries = [
    { cat: 1, type: 1, label: "prodej bytu", count: 15 },
    { cat: 2, type: 1, label: "prodej domu", count: 8 },
    { cat: 1, type: 2, label: "pronajem bytu", count: 5 },
    { cat: 3, type: 1, label: "prodej pozemku", count: 4 },
    { cat: 4, type: 1, label: "prodej komercni", count: 3 },
  ];

  for (const q of queries) {
    console.log(`  Fetching ${q.label}...`);
    const url = `${SREALITY_API}/estates?category_main_cb=${q.cat}&category_type_cb=${q.type}&per_page=${q.count}&page=0&locality_region_id=10&czk_price_summary_order=2`;
    const data = await fetchSreality(url);
    const items = data._embedded?.estates ?? [];
    estates.push(...items.slice(0, q.count));
    await sleep(DELAY_MS);
  }

  return estates.slice(0, count);
}

// Fetch detail for a single estate
async function fetchDetail(hashId) {
  const url = `${SREALITY_API}/estates/${hashId}`;
  return fetchSreality(url);
}

// Download image and upload to R2 via local API
async function uploadImageToR2(imageUrl, propertySlug) {
  try {
    // Download image from Sreality CDN - use view size (749x562) with Referer
    const resp = await fetch(imageUrl, {
      headers: { "User-Agent": UA, "Referer": "https://www.sreality.cz/" },
    });
    if (!resp.ok) return null;

    const buffer = await resp.arrayBuffer();
    const contentType = resp.headers.get("content-type") || "image/jpeg";
    const ext = contentType.includes("png") ? "png" : "jpg";
    const filename = `${propertySlug}-${Date.now()}-${Math.random().toString(36).slice(2,6)}.${ext}`;

    // Upload to R2 via local API
    const formData = new FormData();
    formData.append("file", new Blob([buffer], { type: contentType }), filename);
    formData.append("mediaType", "image");

    const uploadResp = await fetch(`${API_BASE}/api/upload`, {
      method: "POST",
      body: formData,
    });

    if (!uploadResp.ok) {
      const err = await uploadResp.text();
      console.error(`    Upload failed: ${err}`);
      return null;
    }

    const result = await uploadResp.json();
    return result.url;
  } catch (e) {
    console.error(`    Image upload error: ${e.message}`);
    return null;
  }
}

// Convert Sreality detail to our property format
function convertToProperty(detail, imageUrls) {
  const seo = detail.seo || {};
  const mainCat = seo.category_main_cb || 1;
  const typeCb = seo.category_type_cb || 1;
  const subCb = seo.category_sub_cb || 2;
  const items = detail.items || [];
  const map = detail.map || {};

  const name = detail.name?.value || "Nemovitost";
  const locality = detail.locality?.value || "";
  const price = detail.price_czk?.value_raw || 0;

  // Parse city from locality (usually "Ulice, Mesto" or "Mesto - Cast")
  const localityParts = locality.split(",").map(s => s.trim());
  const city = localityParts[localityParts.length - 1] || "Praha";
  const district = localityParts.length > 1 ? localityParts[0] : city;

  const slug = slugify(`${name}-${city}-${Date.now().toString(36)}`);
  const area = Number(getItemValue(items, "Užitná ploch") || getItemValue(items, "Plocha zastavěná") || getItemValue(items, "Celková plocha") || 0);
  const landArea = Number(getItemValue(items, "Plocha pozemku") || 0) || undefined;

  const conditionRaw = getItemValue(items, "Stav objektu");
  const ownershipRaw = getItemValue(items, "Vlastnictví");
  const furnishingRaw = getItemValue(items, "Vybavení");
  const energyRaw = getItemValue(items, "Energetická náročnost budovy");

  const floorRaw = getItemValue(items, "Podlaží");
  let floor = undefined;
  let totalFloors = undefined;
  if (typeof floorRaw === "string") {
    const m = floorRaw.match(/(\d+)\.\s*podlaží\s*z\s*celkem\s*(\d+)/i);
    if (m) { floor = Number(m[1]); totalFloors = Number(m[2]); }
  }

  const description = detail.text?.value || "";
  const summary = description.slice(0, 300).replace(/\n/g, " ").trim() || name;

  const priceUnit = typeCb === 2 ? "za_mesic" : undefined;
  const priceNote = getItemValue(items, "Poznámka k ceně") || undefined;

  const parkingRaw = getItemValue(items, "Parkování");
  let parking = undefined;
  if (typeof parkingRaw === "string") {
    parking = PARKING_MAP[parkingRaw] || undefined;
  } else if (typeof parkingRaw === "number" && parkingRaw > 0) {
    parking = "parkovaci_stani";
  }

  return {
    slug,
    title: name,
    listing_type: TYPE_MAP[typeCb] || "sale",
    category: CATEGORY_MAP[mainCat] || "apartment",
    subtype: getSubtype(mainCat, subCb),
    rooms_label: getRoomsLabel(mainCat, subCb),
    price,
    price_note: priceNote,
    price_unit: priceUnit,
    city,
    district,
    location_label: locality,
    latitude: map.lat || 50.08,
    longitude: map.lon || 14.42,
    area: area || 50,
    land_area: landArea,
    summary,
    description: description || undefined,
    condition: CONDITION_MAP[conditionRaw] || undefined,
    ownership: OWNERSHIP_MAP[ownershipRaw] || undefined,
    furnishing: FURNISHING_MAP[furnishingRaw] || undefined,
    energy_rating: ENERGY_MAP[energyRaw] || undefined,
    floor,
    total_floors: totalFloors,
    parking,
    balcony: getItemBool(items, "Balkón") ?? false,
    terrace: getItemBool(items, "Terasa") ?? false,
    garden: getItemBool(items, "Zahrada") ?? false,
    elevator: getItemBool(items, "Výtah") ?? false,
    cellar: getItemBool(items, "Sklep") !== null ? true : false,
    garage: getItemBool(items, "Garáž") ?? false,
    pool: false,
    loggia: getItemBool(items, "Lodžie") ?? false,
    image_src: imageUrls[0] || "/images/placeholder.jpg",
    image_alt: name,
    images: imageUrls,
    featured: false,
    active: true,
    broker_id: null,
  };
}

// Main
async function main() {
  console.log("=== Sreality -> Nemovizor Import ===\n");

  // 1. Fetch listing summaries
  console.log("1) Fetching listings from Sreality...");
  const listings = await fetchListings(35);
  console.log(`   Found ${listings.length} listings\n`);

  let imported = 0;
  let failed = 0;

  for (let i = 0; i < listings.length; i++) {
    const listing = listings[i];
    const hashId = listing.hash_id;
    console.log(`\n[${i + 1}/${listings.length}] ${listing.name} — ${listing.locality}`);
    console.log(`  Price: ${listing.price?.toLocaleString()} Kč | ID: ${hashId}`);

    try {
      // 2. Fetch detail
      await sleep(DELAY_MS);
      const detail = await fetchDetail(hashId);

      // 3. Upload images (first 5)
      const srealityImages = detail._embedded?.images || [];
      const imageLinks = srealityImages
        .slice(0, 3) // max 3 images per property to limit requests
        .map(img => img._links?.view?.href || img._links?.gallery?.href)
        .filter(Boolean);

      const slug = slugify(`${detail.name?.value || "nemovitost"}-${Date.now().toString(36)}`);
      console.log(`  Uploading ${imageLinks.length} images...`);

      const imageUrls = [];
      for (const imgUrl of imageLinks) {
        await sleep(1000); // 1s between image downloads
        const r2Url = await uploadImageToR2(imgUrl, slug);
        if (r2Url) {
          imageUrls.push(r2Url);
          process.stdout.write(".");
        } else {
          process.stdout.write("x");
        }
      }
      console.log(` (${imageUrls.length} uploaded)`);

      // 4. Convert and insert
      const property = convertToProperty(detail, imageUrls);

      const insertResp = await fetch(`${API_BASE}/api/properties`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(property),
      });

      if (!insertResp.ok) {
        const err = await insertResp.json();
        console.error(`  INSERT FAILED: ${JSON.stringify(err)}`);
        failed++;
        continue;
      }

      const result = await insertResp.json();
      console.log(`  OK — slug: ${property.slug}, city: ${property.city}`);
      imported++;
    } catch (e) {
      console.error(`  ERROR: ${e.message}`);
      failed++;
    }
  }

  console.log(`\n=== Done! Imported: ${imported}, Failed: ${failed} ===`);
}

main().catch(e => { console.error(e); process.exit(1); });
