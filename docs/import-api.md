# Nemovizor Import API — Dokumentace pro PTF.cz Worker

## Zakladni informace

- **Base URL**: `https://nemovizor.vercel.app`
- **Format**: JSON (Content-Type: application/json)
- **Auth**: Bearer token s `write:import` scopem (`Authorization: Bearer nvz_xxx`)
- **Pozadavek**: API klic musi byt typu `owner_type=agency`
- **Rate limit**: 60 req/min
- **Max velikost batche**: 1000 items

## Flow

```
1. POST /api/v1/import/batch         → 202 { job_id, poll_url }
2. Cron worker zpracuje (do 1 min)   → items se zpracovavaji
3. GET /api/v1/import/jobs/{job_id}  → progress + per-item results
```

---

## Endpointy

### POST /api/v1/import/batch

Odesle davku entit ke zpracovani. Vraci job_id pro pollování.

**Request:**
```json
{
  "external_source": "ptf",
  "agency": { ... },
  "branches": [ ... ],
  "brokers": [ ... ],
  "properties": [ ... ],
  "deactivate_missing": false,
  "callback_url": "https://ptf.cz/api/nemovizor-callback"
}
```

**Response (202):**
```json
{
  "job_id": "uuid",
  "status": "pending",
  "total_items": 42,
  "poll_url": "/api/v1/import/jobs/uuid"
}
```

**Poradi zpracovani**: agency (0) → branches (100+) → brokers (200+) → properties (300+)

### GET /api/v1/import/jobs/{id}

Poll stavu jobu. Po dokonceni vraci per-item results.

**Response (completed):**
```json
{
  "id": "uuid",
  "status": "completed",
  "total_items": 42,
  "completed_items": 42,
  "failed_items": 0,
  "warned_items": 3,
  "skipped_items": 0,
  "items": [
    {
      "external_id": "ptf-prop-123",
      "entity_type": "property",
      "status": "success",
      "nemovizor_id": "uuid",
      "nemovizor_slug": "byt-2kk-praha-vinohrady",
      "action": "created",
      "warnings": [],
      "errors": [],
      "processing_time_ms": 324
    }
  ]
}
```

**Stavy jobu**: `pending` → `processing` → `completed` / `failed`
**Stavy items**: `success`, `warning`, `error`, `skipped`
**Akce**: `created`, `updated`, `unchanged`, `deactivated`

### GET /api/v1/import/jobs

Seznam poslednich jobu pro danou agenturu. Query: `?limit=20`

### DELETE /api/v1/import/properties/{external_id}

Synchronni deaktivace jedne nabidky. Query: `?external_source=ptf`

---

## Volby batche

| Pole | Typ | Default | Popis |
|------|-----|---------|-------|
| `external_source` | string | `"api"` | Identifikator zdroje (napr. `"ptf"`, `"realman"`) |
| `deactivate_missing` | boolean | `false` | Full sync: deaktivuje nabidky ktere NEJSOU v batchi |
| `callback_url` | string? | — | Webhook URL volana po dokonceni jobu (s HMAC podpisem) |

---

## Deduplikace

| Entita | Primarni klic | Fallback |
|--------|--------------|----------|
| Agency | API key owner_id | — |
| Branch | `external_id` + `external_source` | slug |
| Broker | `external_id` + `external_source` | email v ramci agency |
| Property | `external_id` + `external_source` | slug |

Pokud entita s danym `external_id + external_source` existuje → UPDATE.
Pokud ne → INSERT.

---

## Schemata entit

### Agency

```json
{
  "external_id": "ptf-1",
  "name": "PTF Reality",
  "logo": "https://...",
  "description": "Popis kancelare",
  "phone": "+420603834921",
  "email": "info@ptf.cz",
  "website": "https://ptf.cz",
  "seat_city": "Plzen",
  "seat_address": "Radynska 33",
  "founded_year": 1998,
  "specializations": ["Rezidencni nemovitosti", "Komercni nemovitosti"]
}
```

### Branch

```json
{
  "external_id": "ptf-branch-1",
  "name": "Pobocka Praha",
  "address": "Vaclavske namesti 1",
  "city": "Praha",
  "zip": "11000",
  "phone": "+420777123456",
  "email": "praha@ptf.cz",
  "latitude": 50.0755,
  "longitude": 14.4378,
  "is_headquarters": false
}
```

### Broker

```json
{
  "external_id": "ptf-broker-1",
  "name": "David Choc",
  "email": "david@ptf.cz",
  "phone": "+420774052232",
  "photo": "https://...",
  "title": "Senior Partner",
  "bio": "Kratke bio pro karticku",
  "specialization": "Rezidencni nemovitosti",
  "languages": ["Cestina", "Anglictina", "Nemcina"],
  "certifications": ["ARK CR"],
  "year_started": 1995,
  "branch_external_id": "ptf-branch-1",
  "linkedin": "https://linkedin.com/in/davidchoc",
  "instagram": "davidchoc_reality",
  "facebook": "https://facebook.com/ptfreality",
  "website": "https://ptf.cz/david-choc"
}
```

### Property (kompletni)

**Povinna pole:**
```json
{
  "external_id": "ptf-123",
  "title": "Prodej bytu 2+kk, 55 m2, Praha 2 - Vinohrady",
  "listing_type": "sale",
  "category": "apartment"
}
```

**Kompletni priklad:**
```json
{
  "external_id": "ptf-123",
  "title": "Prodej bytu 2+kk, 55 m2, Praha 2 - Vinohrady",
  "listing_type": "sale",
  "category": "apartment",
  "subtype": "2+kk",
  "rooms_label": "2+kk",

  "price": 4500000,
  "price_currency": "czk",
  "price_unit": "za_nemovitost",
  "price_note": "Bez provize",
  "price_negotiation": true,

  "city": "Praha",
  "district": "Praha 2",
  "city_part": "Vinohrady",
  "street": "Korunni 42",
  "zip": "12000",
  "region": "Praha",
  "country": "cz",
  "latitude": 50.0755,
  "longitude": 14.4378,
  "location_label": "Praha 2 - Vinohrady",

  "area": 55,
  "land_area": null,
  "floor_area": 52,
  "balcony_area": 3,
  "terrace_area": null,
  "cellar_area": 2,
  "garden_area": null,
  "built_up_area": null,
  "loggia_area": null,
  "basin_area": null,
  "nolive_total_area": null,
  "offices_area": null,
  "production_area": null,
  "shop_area": null,
  "store_area": null,
  "workshop_area": null,

  "summary": "Svetly byt 2+kk s balkonem v klidne ulici",
  "description": "Nabizime k prodeji svetly byt...",

  "condition": "po_rekonstrukci",
  "ownership": "osobni",
  "furnishing": "castecne",
  "energy_rating": "C",
  "building_material": "cihla",
  "flooring": "drevo",

  "floor": 3,
  "total_floors": 5,
  "underground_floors": 1,
  "ceiling_height": 2.8,

  "year_built": 1935,
  "last_renovation": 2022,

  "balcony": true,
  "terrace": false,
  "garden": false,
  "elevator": true,
  "cellar": true,
  "garage": false,
  "pool": false,
  "loggia": false,
  "low_energy": false,
  "ftv_panels": false,
  "solar_panels": false,
  "mortgage": true,

  "parking": "parkovaci_stani",
  "parking_spaces": 1,
  "garage_count": 0,

  "easy_access": "ne",
  "object_type": "patrovy",
  "object_kind": "v_bloku",
  "object_location": "centrum",
  "flat_class": "jednopodlazni",

  "heating": ["ustredni"],
  "heating_element": ["radiatory"],
  "heating_source": ["plyn"],
  "water_heat_source": ["bojler"],

  "electricity": ["230V"],
  "gas": ["zaveden"],
  "water": ["vodovod"],
  "gully": ["kanalizace"],
  "road_type": ["asfaltova"],
  "telecommunication": ["telefon"],
  "transport": ["mhd", "metro"],
  "internet_connection_type": ["opticky_kabel"],

  "internet_connection_provider": "O2",
  "internet_connection_speed": 1000,

  "surroundings_type": "bydleni",
  "protection": null,
  "circuit_breaker": "25a",
  "phase_distribution": "3_faze",

  "annuity": 3500,
  "cost_of_living": "3500 Kc/mesic",
  "commission": 3,
  "mortgage_percent": 80,
  "refundable_deposit": 90000,

  "lease_type": null,
  "ready_date": null,
  "exclusively_at_rk": true,
  "personal_transfer": "ano",
  "num_owners": 1,

  "keywords": ["vinohrady", "balkon", "centrum", "metro"],
  "apartment_number": 12,

  "matterport_url": "https://my.matterport.com/show/?m=xxx",
  "mapy_panorama_url": null,

  "broker_external_id": "ptf-broker-1",
  "active": true,

  "images": [
    { "url": "https://cdn.ptf.cz/foto1.jpg", "title": "Obyvaci pokoj", "order": 0 },
    { "url": "https://cdn.ptf.cz/foto2.jpg", "title": "Kuchyne", "order": 1 },
    { "url": "https://cdn.ptf.cz/foto3.jpg", "title": "Loznice", "order": 2 }
  ]
}
```

---

## Ciselniky (enum hodnoty)

### listing_type (typ nabidky)
| Hodnota | Popis |
|---------|-------|
| `sale` | Prodej |
| `rent` | Pronajem |
| `auction` | Drazba |
| `shares` | Spoluvlastnictvi |

### category (kategorie nemovitosti)
| Hodnota | Popis |
|---------|-------|
| `apartment` | Byt |
| `house` | Dum |
| `land` | Pozemek |
| `commercial` | Komercni |
| `other` | Ostatni |

### condition (stav nemovitosti)
| Hodnota | Popis |
|---------|-------|
| `novostavba` | Novostavba |
| `velmi_dobry` | Velmi dobry |
| `dobry` | Dobry |
| `po_rekonstrukci` | Po rekonstrukci |
| `v_rekonstrukci` | V rekonstrukci |
| `pred_rekonstrukci` | Pred rekonstrukci |
| `ve_vystavbe` | Ve vystavbe |
| `projekt` | Projekt |
| `spatny` | Spatny |
| `k_demolici` | K demolici |

### ownership (vlastnictvi)
| Hodnota | Popis |
|---------|-------|
| `osobni` | Osobni |
| `druzstevni` | Druzstevni |
| `statni` | Statni/obecni |

### furnishing (vybaveni)
| Hodnota | Popis |
|---------|-------|
| `ano` | Plne vybaveno |
| `ne` | Nevybaveno |
| `castecne` | Castecne |

### energy_rating (energeticka trida)
`A`, `B`, `C`, `D`, `E`, `F`, `G`

### building_material (stavebni material)
| Hodnota | Popis |
|---------|-------|
| `cihla` | Cihla |
| `panel` | Panel |
| `drevostavba` | Drevostavba |
| `kamen` | Kamen |
| `montovana` | Montovana |
| `skeletal` | Skeletal |
| `smisena` | Smisena |
| `modularni` | Modularni |

### parking (parkovani)
| Hodnota | Popis |
|---------|-------|
| `garaz` | Garaz |
| `dvojgaraz` | Dvojgaraz |
| `trojgaraz` | Trojgaraz |
| `podzemni` | Podzemni garaz |
| `parkovaci_stani` | Parkovaci stani |
| `zadne` | Zadne |

### price_currency (mena)
`czk`, `eur`, `usd`, `gbp`

### price_unit (cenova jednotka)
| Hodnota | Popis |
|---------|-------|
| `za_nemovitost` | Za celou nemovitost |
| `za_mesic` | Za mesic |
| `za_m2` | Za m2 |
| `za_m2_mesic` | Za m2/mesic |
| `za_m2_rok` | Za m2/rok |
| `za_rok` | Za rok |
| `za_den` | Za den |
| `za_hodinu` | Za hodinu |
| `za_m2_den` | Za m2/den |
| `za_m2_hodinu` | Za m2/hodinu |

### object_type (typ objektu)
`prizemni`, `patrovy`

### object_kind (druh objektu)
`radovy`, `rohovy`, `v_bloku`, `samostatny`

### object_location (poloha objektu)
`centrum`, `klidna_cast`, `rusna_cast`, `okraj`, `sidliste`, `polosamota`, `samota`

### flat_class (trida bytu)
`mezonet`, `loft`, `podkrovni`, `jednopodlazni`

### surroundings_type (typ okoli)
`bydleni`, `bydleni_kancelare`, `obchodni`, `administrativni`, `prumyslova`, `venkovska`, `rekreacni`, `rekreacne_nevyuzita`

### protection (ochrana)
`ochranne_pasmo`, `narodni_park`, `chko`, `pamatkova_zona`, `pamatkova_rezervace`, `kulturni_pamatka`, `narodni_kulturni_pamatka`

### circuit_breaker (jistic)
`16a`, `20a`, `25a`, `32a`, `40a`, `50a`, `63a`

### phase_distribution (faze)
`1_faze`, `3_faze`

### auction_kind (typ drazby)
`nedobrovolna`, `dobrovolna`, `exekucni`, `aukce`, `obchodni_soutez`

### lease_type (typ najmu)
`najem`, `podnajem`

### extra_info (stav nabidky)
`rezervovano`, `prodano`

### easy_access (bezbarierovy pristup)
`ano`, `ne`

### personal_transfer (osobni prevzeti)
`ano`, `ne`

---

## Obrazky

```json
{
  "images": [
    {
      "url": "https://cdn.example.com/photo1.jpg",
      "title": "Obyvaci pokoj",
      "order": 0
    }
  ]
}
```

- Max 50 obrazku na nemovitost
- Podporovane formaty: JPEG, PNG, WebP, AVIF
- Max velikost: 10 MB na obrazek
- Prvni obrazek (order=0) se nastavi jako hlavni fotka (`image_src`)
- Obrazky se stahuji a ukladaji do Cloudflare R2
- Pokud stazeni selze → warning (ne error), puvodni URL se pouzije

---

## Priklad: PTF.cz worker

```typescript
// PTF Nemovizor worker — odesle davku nabidek
async function syncToNemovizor(properties: PTFProperty[], brokers: PTFBroker[]) {
  const API_KEY = process.env.NEMOVIZOR_API_KEY; // nvz_xxx
  const BASE_URL = "https://nemovizor.vercel.app";

  // 1. Odeslat batch
  const res = await fetch(`${BASE_URL}/api/v1/import/batch`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      external_source: "ptf",
      brokers: brokers.map(b => ({
        external_id: `ptf-${b.id}`,
        name: `${b.first_name} ${b.last_name}`,
        email: b.email,
        phone: b.phone,
        photo: b.photo_url,
      })),
      properties: properties.map(p => ({
        external_id: `ptf-${p.id}`,
        title: p.title,
        listing_type: mapOfferType(p.offer_type), // "prodej" → "sale"
        category: mapCategory(p.property_type),    // "byt" → "apartment"
        price: p.price,
        price_currency: "czk",
        city: p.city,
        area: p.area,
        broker_external_id: `ptf-${p.agent_id}`,
        images: p.photos.map((url, i) => ({ url, order: i })),
        active: p.status === "active",
      })),
    }),
  });

  const { job_id } = await res.json();

  // 2. Pollovat vysledky
  let completed = false;
  while (!completed) {
    await new Promise(r => setTimeout(r, 10000)); // wait 10s

    const statusRes = await fetch(`${BASE_URL}/api/v1/import/jobs/${job_id}`, {
      headers: { "Authorization": `Bearer ${API_KEY}` },
    });
    const job = await statusRes.json();

    if (job.status === "completed" || job.status === "failed") {
      completed = true;

      // 3. Zpracovat vysledky
      for (const item of job.items || []) {
        await db.properties.update(
          { nemovizor_id: item.nemovizor_id, nemovizor_synced_at: new Date() },
          { where: { external_id: item.external_id.replace("ptf-", "") } }
        );

        if (item.status === "error") {
          console.error(`Import failed: ${item.external_id}`, item.errors);
        }
        if (item.warnings.length > 0) {
          console.warn(`Import warnings: ${item.external_id}`, item.warnings);
        }
      }
    }
  }
}
```

---

## Callback webhook

Pokud nastavis `callback_url`, Nemovizor POST-ne vysledek po dokonceni jobu:

```
POST https://ptf.cz/api/nemovizor-callback
Content-Type: application/json
X-Nemovizor-Signature: sha256=abc123...
X-Nemovizor-Event: import.completed

{
  "id": "job-uuid",
  "status": "completed",
  "completed_items": 42,
  "failed_items": 0,
  "warned_items": 3,
  "skipped_items": 0
}
```

**Overeni podpisu:**
```typescript
import { createHmac } from "crypto";
const expected = createHmac("sha256", CRON_SECRET)
  .update(rawBody)
  .digest("hex");
const valid = signature === `sha256=${expected}`;
```

---

## Chybove stavy

| HTTP | Popis |
|------|-------|
| 202 | Batch prijat, zpracovava se |
| 400 | Nevalidni payload (Zod validace) |
| 401 | Chybejici nebo neplatny API klic |
| 403 | Klic nema `write:import` scope nebo neni `owner_type=agency` |
| 404 | Job nenalezen |
| 500 | Interni chyba serveru |

---

## Dulezite poznamky

1. **Vsechna pole krome `external_id`, `title`, `listing_type`, `category` jsou nepovinne** — Nemovizor zobrazi co dostane
2. **Enum hodnoty jsou case-sensitive** — posilejte presne jak je v ciselniku
3. **Pole ktera nejsou v Zod schema ale existuji v DB** projdou pres `.passthrough()` a ulozi se
4. **Obrazky se stahuji asynchronne** — velke batche s mnoha fotkami se zpracovavaji po castech (20 items/tick)
5. **Duplicity se resi automaticky** — stejny `external_id + external_source` = UPDATE misto INSERT
6. **`deactivate_missing: true`** = full sync mód — nabidky z teto agency ktere NEJSOU v batchi se deaktivuji
