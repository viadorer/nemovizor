#!/usr/bin/env node
// Fix: import missing rentals + update images for existing properties
// Usage: node scripts/import-sreality-fix.mjs

const API_BASE = "http://localhost:60608";
const SREALITY_API = "https://www.sreality.cz/api/cs/v2";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)";
const DELAY_MS = 2000;

function slugify(text) {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
}

function getItemValue(items, name) {
  const item = items.find(i => i.name === name);
  return item?.value ?? null;
}

const CONDITION_MAP = {
  "Velmi dobrý": "velmi_dobry", "Dobrý": "dobry", "Špatný": "spatny",
  "Po rekonstrukci": "po_rekonstrukci", "Novostavba": "novostavba",
  "Před rekonstrukcí": "pred_rekonstrukci",
};
const OWNERSHIP_MAP = { "Osobní": "osobni", "Družstevní": "druzstevni" };
const SUBTYPE_MAP = {
  2: "1+kk", 3: "1+1", 4: "2+kk", 5: "2+1", 6: "3+kk", 7: "3+1",
  8: "4+kk", 9: "4+1", 10: "5+kk", 11: "5+1", 12: "6+", 16: "Atypicky",
};

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchSreality(url) {
  const resp = await fetch(url, { headers: { "User-Agent": UA } });
  if (!resp.ok) throw new Error(`Sreality ${resp.status}`);
  return resp.json();
}

async function uploadImage(imageUrl, slug) {
  try {
    const viewUrl = imageUrl.replace(/\?fl=.*$/, "?fl=res,800,600,3|shr,,20|jpg,90");
    const resp = await fetch(viewUrl, {
      headers: { "User-Agent": UA, "Referer": "https://www.sreality.cz/" },
    });
    if (!resp.ok) return null;

    const buffer = await resp.arrayBuffer();
    const filename = `${slug}-${Date.now()}-${Math.random().toString(36).slice(2,6)}.jpg`;
    const formData = new FormData();
    formData.append("file", new Blob([buffer], { type: "image/jpeg" }), filename);
    formData.append("mediaType", "image");

    const uploadResp = await fetch(`${API_BASE}/api/upload`, { method: "POST", body: formData });
    if (!uploadResp.ok) return null;
    const result = await uploadResp.json();
    return result.url;
  } catch { return null; }
}

async function main() {
  console.log("=== Fix: Import rentals + images ===\n");

  // 1. Import 5 rentals
  console.log("1) Fetching rental listings...");
  const data = await fetchSreality(`${SREALITY_API}/estates?category_main_cb=1&category_type_cb=2&per_page=5&page=0&locality_region_id=10`);
  const rentals = data._embedded?.estates ?? [];
  console.log(`   Found ${rentals.length} rentals\n`);

  for (let i = 0; i < rentals.length; i++) {
    const listing = rentals[i];
    console.log(`\n[${i+1}/${rentals.length}] ${listing.name} — ${listing.locality}`);

    await sleep(DELAY_MS);
    const detail = await fetchSreality(`${SREALITY_API}/estates/${listing.hash_id}`);
    const items = detail.items || [];
    const map = detail.map || {};
    const seo = detail.seo || {};
    const subCb = seo.category_sub_cb || 2;

    const name = detail.name?.value || "Nemovitost";
    const locality = detail.locality?.value || "";
    const parts = locality.split(",").map(s => s.trim());
    const city = parts[parts.length - 1] || "Praha";
    const district = parts.length > 1 ? parts[0] : city;
    const slug = slugify(`${name}-${city}-${Date.now().toString(36)}`);

    // Upload images
    const srealityImages = detail._embedded?.images || [];
    const imageLinks = srealityImages.slice(0, 3).map(img =>
      img._links?.view?.href || img._links?.self?.href
    ).filter(Boolean);

    console.log(`  Uploading ${imageLinks.length} images...`);
    const imageUrls = [];
    for (const imgUrl of imageLinks) {
      await sleep(1000);
      const r2Url = await uploadImage(imgUrl, slug);
      if (r2Url) { imageUrls.push(r2Url); process.stdout.write("."); }
      else process.stdout.write("x");
    }
    console.log(` (${imageUrls.length} uploaded)`);

    const area = Number(getItemValue(items, "Užitná ploch") || getItemValue(items, "Celková plocha") || 50);
    const description = detail.text?.value || "";
    const conditionRaw = getItemValue(items, "Stav objektu");
    const ownershipRaw = getItemValue(items, "Vlastnictví");

    const property = {
      slug, title: name, listing_type: "rent", category: "apartment",
      subtype: SUBTYPE_MAP[subCb] || "Atypicky",
      rooms_label: SUBTYPE_MAP[subCb] || "Atypicky",
      price: detail.price_czk?.value_raw || 0,
      price_unit: "za_mesic",
      city, district, location_label: locality,
      latitude: map.lat || 50.08, longitude: map.lon || 14.42,
      area, summary: description.slice(0, 300).replace(/\n/g, " ").trim() || name,
      description: description || undefined,
      condition: CONDITION_MAP[conditionRaw] || undefined,
      ownership: OWNERSHIP_MAP[ownershipRaw] || undefined,
      image_src: imageUrls[0] || "/images/placeholder.jpg",
      image_alt: name, images: imageUrls,
      balcony: false, terrace: false, garden: false, elevator: false,
      cellar: false, garage: false, pool: false, loggia: false,
      featured: false, active: true, broker_id: null,
    };

    const resp = await fetch(`${API_BASE}/api/properties`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(property),
    });

    if (!resp.ok) { const err = await resp.json(); console.error(`  FAILED: ${JSON.stringify(err)}`); }
    else console.log(`  OK — ${slug}`);
  }

  // 2. Now update images for existing properties that have no R2 images
  console.log("\n\n2) Updating images for existing properties...");

  // Get all properties without R2 images
  const propsResp = await fetch(`${API_BASE}/api/properties?limit=100`);
  const propsData = await propsResp.json();
  const noImageProps = propsData.data?.filter(p =>
    !p.image_src || p.image_src === "/images/placeholder.jpg" || p.image_src.startsWith("/images/")
  ) || [];
  console.log(`   ${noImageProps.length} properties need images`);

  // For these, we'll search Sreality for matching properties and grab their images
  for (let i = 0; i < Math.min(noImageProps.length, 30); i++) {
    const prop = noImageProps[i];
    console.log(`\n  [${i+1}] ${prop.title} (${prop.city})`);

    // Search Sreality for this title
    const searchQuery = encodeURIComponent(prop.title.split(" ").slice(0, 4).join(" "));
    await sleep(DELAY_MS);

    try {
      const searchUrl = `${SREALITY_API}/estates?category_main_cb=1&category_type_cb=1&per_page=1&page=0&locality_region_id=10`;
      const searchData = await fetchSreality(searchUrl);
      const found = searchData._embedded?.estates?.[0];
      if (!found) { console.log("    No match"); continue; }

      await sleep(DELAY_MS);
      const detail = await fetchSreality(`${SREALITY_API}/estates/${found.hash_id}`);
      const srealityImages = detail._embedded?.images || [];
      const imageLinks = srealityImages.slice(0, 3).map(img =>
        img._links?.view?.href || img._links?.self?.href
      ).filter(Boolean);

      const slug = prop.slug || slugify(prop.title);
      const imageUrls = [];
      for (const imgUrl of imageLinks) {
        await sleep(1000);
        const r2Url = await uploadImage(imgUrl, slug);
        if (r2Url) { imageUrls.push(r2Url); process.stdout.write("."); }
        else process.stdout.write("x");
      }
      console.log(` (${imageUrls.length} uploaded)`);

      if (imageUrls.length > 0) {
        // Update via Supabase REST directly (our API doesn't have PATCH)
        console.log(`    Skipping DB update (no PATCH endpoint) — images: ${imageUrls[0]}`);
      }
    } catch (e) {
      console.error(`    Error: ${e.message}`);
    }
  }

  console.log("\n=== Done! ===");
}

main().catch(e => { console.error(e); process.exit(1); });
