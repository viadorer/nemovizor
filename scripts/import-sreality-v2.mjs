#!/usr/bin/env node
// ============================================================
// Sreality Import v2 — with working image uploads to R2
// 1. Deletes old Sreality imports (no R2 images)
// 2. Re-imports with photos
// Usage: node scripts/import-sreality-v2.mjs
// ============================================================

const API_BASE = "http://localhost:60608";
const SREALITY_API = "https://www.sreality.cz/api/cs/v2";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)";
const DELAY_MS = 2000;

const CATEGORY_MAP = { 1: "apartment", 2: "house", 3: "land", 4: "commercial", 5: "other" };
const TYPE_MAP = { 1: "sale", 2: "rent", 3: "auction" };

const SUBTYPE_APARTMENT = {
  2: "1+kk", 3: "1+1", 4: "2+kk", 5: "2+1", 6: "3+kk", 7: "3+1",
  8: "4+kk", 9: "4+1", 10: "5+kk", 11: "5+1", 12: "6+", 16: "Atypicky",
};
const SUBTYPE_HOUSE = {
  37: "Rodinny", 39: "Vila", 43: "Chalupa", 44: "Chata", 33: "Zemedelska usedlost",
};
const SUBTYPE_LAND = { 19: "Bydleni", 18: "Komercni", 22: "Lesy", 23: "Zahrady", 25: "Ostatni" };

function getSubtype(cat, sub) {
  if (cat === 1) return SUBTYPE_APARTMENT[sub] || "Atypicky";
  if (cat === 2) return SUBTYPE_HOUSE[sub] || "Rodinny";
  if (cat === 3) return SUBTYPE_LAND[sub] || "Ostatni";
  if (cat === 4) return "Kancelare";
  return "Ostatni";
}

function slugify(t) {
  return t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
}

function getItem(items, name) {
  return items.find(i => i.name === name)?.value ?? null;
}

const CONDITION_MAP = {
  "Velmi dobrý": "velmi_dobry", "Dobrý": "dobry", "Novostavba": "novostavba",
  "Po rekonstrukci": "po_rekonstrukci", "Před rekonstrukcí": "pred_rekonstrukci",
  "Ve výstavbě": "ve_vystavbe", "Projekt": "projekt",
};
const OWNERSHIP_MAP = { "Osobní": "osobni", "Družstevní": "druzstevni", "Státní / obecní": "statni" };
const FURNISHING_MAP = { "Vybavený": "ano", "Nevybavený": "ne", "Částečně": "castecne", "Částečně vybavený": "castecne" };

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchS(url) {
  const r = await fetch(url, { headers: { "User-Agent": UA } });
  if (!r.ok) throw new Error(`Sreality ${r.status}: ${url.slice(0, 80)}`);
  return r.json();
}

async function uploadImage(imageUrl, slug) {
  try {
    const resp = await fetch(imageUrl, {
      headers: { "User-Agent": UA, "Referer": "https://www.sreality.cz/" },
    });
    if (!resp.ok) return null;
    const buf = await resp.arrayBuffer();
    if (buf.byteLength < 1000) return null; // skip tiny/error responses

    const filename = `${slug}-${Date.now()}-${Math.random().toString(36).slice(2,6)}.jpg`;
    const formData = new FormData();
    formData.append("file", new Blob([buf], { type: "image/jpeg" }), filename);
    formData.append("mediaType", "image");

    const upResp = await fetch(`${API_BASE}/api/upload`, { method: "POST", body: formData });
    if (!upResp.ok) return null;
    return (await upResp.json()).url;
  } catch { return null; }
}

async function main() {
  console.log("=== Sreality Import v2 ===\n");

  // Step 1: Delete old Sreality imports (properties without R2 images, excluding seed data)
  console.log("1) Cleaning old imports...");
  const propsResp = await fetch(`${API_BASE}/api/properties?limit=200`);
  const propsData = await propsResp.json();
  const toDelete = propsData.data?.filter(p => {
    // Keep seed properties (they have broker_id set typically or specific slugs)
    const isPlaceholder = !p.image_src || p.image_src === "/images/placeholder.jpg" || p.image_src.startsWith("/images/");
    // Only delete if it looks like a Sreality import (title starts with "Prodej" or "Pronájem")
    const isSrealityImport = /^(Prodej|Pronájem|Pronajem)\s/.test(p.title);
    return isPlaceholder && isSrealityImport;
  }) || [];

  console.log(`   Deleting ${toDelete.length} old imports...`);
  for (const p of toDelete) {
    const resp = await fetch(`${API_BASE}/api/properties?id=${p.id}`, { method: "DELETE" });
    if (resp.ok) process.stdout.write(".");
    else process.stdout.write("x");
  }
  console.log(" done\n");

  // Step 2: Fetch from Sreality
  console.log("2) Fetching listings...");
  const queries = [
    { cat: 1, type: 1, label: "prodej bytu", n: 12 },
    { cat: 2, type: 1, label: "prodej domu", n: 6 },
    { cat: 1, type: 2, label: "pronajem bytu", n: 5 },
    { cat: 3, type: 1, label: "prodej pozemku", n: 4 },
    { cat: 4, type: 1, label: "prodej komercni", n: 3 },
  ];

  const allEstates = [];
  for (const q of queries) {
    console.log(`   ${q.label} (${q.n})...`);
    const data = await fetchS(`${SREALITY_API}/estates?category_main_cb=${q.cat}&category_type_cb=${q.type}&per_page=${q.n}&page=0&locality_region_id=10`);
    allEstates.push(...(data._embedded?.estates ?? []).slice(0, q.n));
    await sleep(DELAY_MS);
  }
  console.log(`   Total: ${allEstates.length}\n`);

  // Step 3: Import each with images
  let ok = 0, fail = 0;

  for (let i = 0; i < allEstates.length; i++) {
    const est = allEstates[i];
    console.log(`\n[${i+1}/${allEstates.length}] ${est.name} — ${est.locality}`);

    try {
      await sleep(DELAY_MS);
      const detail = await fetchS(`${SREALITY_API}/estates/${est.hash_id}`);
      const items = detail.items || [];
      const seo = detail.seo || {};
      const map = detail.map || {};
      const mainCat = seo.category_main_cb || 1;
      const typeCb = seo.category_type_cb || 1;
      const subCb = seo.category_sub_cb || 2;

      const name = detail.name?.value || "Nemovitost";
      const locality = detail.locality?.value || "";
      const parts = locality.split(",").map(s => s.trim());
      const city = parts[parts.length - 1] || "Praha";
      const district = parts.length > 1 ? parts[0] : city;
      const slug = slugify(`${name}-${city}-${Date.now().toString(36)}`);

      // Images — use "view" URLs (749x562, no watermark)
      const srImgs = detail._embedded?.images || [];
      const imgUrls = srImgs.slice(0, 3)
        .map(img => img._links?.view?.href || img._links?.gallery?.href)
        .filter(Boolean);

      console.log(`  Images: ${imgUrls.length} to upload...`);
      const r2Urls = [];
      for (const u of imgUrls) {
        await sleep(1000);
        const r2 = await uploadImage(u, slug);
        if (r2) { r2Urls.push(r2); process.stdout.write("."); }
        else process.stdout.write("x");
      }
      console.log(` (${r2Urls.length} ok)`);

      const area = Number(getItem(items, "Užitná ploch") || getItem(items, "Plocha zastavěná") || getItem(items, "Celková plocha") || 50);
      const landArea = Number(getItem(items, "Plocha pozemku") || 0) || undefined;
      const description = detail.text?.value || "";
      const condRaw = getItem(items, "Stav objektu");
      const ownRaw = getItem(items, "Vlastnictví");
      const furnRaw = getItem(items, "Vybavení");

      let floor, totalFloors;
      const floorRaw = getItem(items, "Podlaží");
      if (typeof floorRaw === "string") {
        const m = floorRaw.match(/(\d+)\.\s*podlaží\s*z\s*celkem\s*(\d+)/i);
        if (m) { floor = +m[1]; totalFloors = +m[2]; }
      }

      const property = {
        slug, title: name,
        listing_type: TYPE_MAP[typeCb] || "sale",
        category: CATEGORY_MAP[mainCat] || "apartment",
        subtype: getSubtype(mainCat, subCb),
        rooms_label: mainCat === 1 ? (SUBTYPE_APARTMENT[subCb] || "Atypicky") : getSubtype(mainCat, subCb),
        price: detail.price_czk?.value_raw || 0,
        price_unit: typeCb === 2 ? "za_mesic" : undefined,
        price_note: getItem(items, "Poznámka k ceně") || undefined,
        city, district, location_label: locality,
        latitude: map.lat || 50.08, longitude: map.lon || 14.42,
        area: area || 50, land_area: landArea,
        summary: (description.slice(0, 300).replace(/\n/g, " ").trim()) || name,
        description: description || undefined,
        condition: CONDITION_MAP[condRaw] || undefined,
        ownership: OWNERSHIP_MAP[ownRaw] || undefined,
        furnishing: FURNISHING_MAP[furnRaw] || undefined,
        floor, total_floors: totalFloors,
        image_src: r2Urls[0] || "/images/placeholder.jpg",
        image_alt: name,
        images: r2Urls,
        balcony: false, terrace: false, garden: false, elevator: false,
        cellar: false, garage: false, pool: false, loggia: false,
        featured: i < 5, // first 5 as featured
        active: true,
        broker_id: null,
      };

      const resp = await fetch(`${API_BASE}/api/properties`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(property),
      });

      if (!resp.ok) {
        const err = await resp.json();
        console.error(`  FAIL: ${err.error}`);
        fail++;
      } else {
        console.log(`  OK — ${property.city}, ${property.price.toLocaleString()} Kč`);
        ok++;
      }
    } catch (e) {
      console.error(`  ERROR: ${e.message}`);
      fail++;
    }
  }

  console.log(`\n=== Done! OK: ${ok}, Failed: ${fail} ===`);
}

main().catch(e => { console.error(e); process.exit(1); });
