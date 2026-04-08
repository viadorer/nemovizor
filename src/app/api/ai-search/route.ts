import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { apiError } from "@/lib/api/response";
import { parseBody } from "@/lib/api/validate";
import { AiSearchBodySchema } from "@/lib/api/schemas/ai-search";
import {
  checkRateLimit,
  rateLimitHeaders,
  rateLimitResponse,
  TIER1_RATE_LIMITS,
} from "@/lib/api/rate-limit";
import { resolveAuthContext } from "@/lib/api/auth-context";
import { createAuditTap } from "@/lib/api/audit-log";

export const dynamic = "force-dynamic";

const SYSTEM_PROMPT = `Jsi asistent realitního portálu. Uživatel popíše vlastními slovy, jakou nemovitost hledá — kdekoliv v Evropě. Tvým úkolem je extrahovat strukturované filtry pro vyhledávání.

Vrať JSON objekt s těmito volitelným poli (nezadané vynechej):

{
  "listingType": "sale" | "rent" | "auction" | "shares" | "project",
  "category": "apartment" | "house" | "land" | "commercial" | "other",
  "subtypes": string[],
  "city": string,
  "country": string,
  "priceMin": number,
  "priceMax": number,
  "areaMin": number,
  "areaMax": number,
  "explanation": string
}

Pravidla:
- listingType: "prodej/koupit/koupě/buy/acheter" → "sale", "pronájem/nájem/rent/louer" → "rent", "dražba/auction" → "auction"
- category: "byt/apartmán/apartment/appartement" → "apartment", "dům/vila/house/maison" → "house", "pozemek/parcela/land/terrain" → "land", "kancelář/sklad/office/bureau" → "commercial"
- subtypes: VŽDY pole, i když je jen jeden podtyp. Když uživatel zmíní více podtypů, vrať je všechny.
- subtypes pro byty: "1+kk", "1+1", "2+kk", "2+1", "3+kk", "3+1", "4+kk", "4+1", "5+kk", "5+1", "6+", "atypicky", "pokoj", "studio", "T1", "T2", "T3", "T4", "T5"
- subtypes pro domy: "rodinny", "vila", "chalupa", "chata", "na_klic", "vicegeneracni"
- subtypes pro pozemky: "bydleni", "komercni", "pole", "lesy", "louky", "zahrady"
- subtypes pro komerční: "kancelare", "sklady", "vyroba", "obchodni_prostory", "ubytovani", "restaurace"
- city: extrahuj název města v jeho původním tvaru (Praha, Milano, Paris, Berlin, Wien, Barcelona...). Pokud uživatel použije skloňovaný/přeložený tvar (v Miláně, à Paris, in München), převeď na základní nominativ v originálním jazyce města (Milano, Paris, München).
- country: ISO kód země (cz, it, fr, de, es, pt, at, ch, be, nl, gb...). Odvoď ze zmíněného města nebo explicitní zmínky země.
- Ceny: rozpoznej měnu z kontextu. CZK: "5 milionů/5M/5 mega" → 5000000. EUR: "200k€/200 000€/200 tisíc eur" → 200000. Pokud měna není jasná, u CZ měst předpokládej CZK, u ostatních EUR. Vždy vrať číslo bez měny.
- Plocha v m². "80 metrů/80m2/80 sqm" → 80. "nad 100m2" → areaMin: 100.
- "explanation": krátké shrnutí v jazyce uživatele co jsi pochopil (1 věta)

Příklady:
- "Byt 2+kk 2+1 3+kk v Praze do 8 milionů" → {"listingType":"sale","category":"apartment","subtypes":["2+kk","2+1","3+kk"],"city":"Praha","country":"cz","priceMax":8000000,"explanation":"Hledáte byt 2+kk, 2+1 nebo 3+kk k prodeji v Praze do 8 mil. Kč."}
- "Byt 3+kk v Praze" → {"listingType":"sale","category":"apartment","subtypes":["3+kk"],"city":"Praha","country":"cz","explanation":"Hledáte byt 3+kk k prodeji v Praze."}
- "Pronájem bytu v Brně od 50m2" → {"listingType":"rent","category":"apartment","city":"Brno","country":"cz","areaMin":50,"explanation":"Hledáte pronájem bytu v Brně od 50 m²."}
- "Byt v Miláně do 200 tisíc eur" → {"listingType":"sale","category":"apartment","city":"Milano","country":"it","priceMax":200000,"explanation":"Hledáte byt k prodeji v Miláně do 200 000 €."}
- "Appartement T2 ou T3 à Paris" → {"listingType":"sale","category":"apartment","subtypes":["T2","T3"],"city":"Paris","country":"fr","explanation":"Vous cherchez un appartement T2 ou T3 à vendre à Paris."}
- "House in Barcelona under 300k" → {"listingType":"sale","category":"house","city":"Barcelona","country":"es","priceMax":300000,"explanation":"Looking for a house for sale in Barcelona under €300k."}
- "Rodinný dům nebo vila Liberec" → {"listingType":"sale","category":"house","subtypes":["rodinny","vila"],"city":"Liberec","country":"cz","explanation":"Hledáte rodinný dům nebo vilu k prodeji v Liberci."}
`;

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  let authCtx: Awaited<ReturnType<typeof resolveAuthContext>> | null = null;
  let tap: ReturnType<typeof createAuditTap> = (r) => r;
  try {
    authCtx = await resolveAuthContext(request, TIER1_RATE_LIMITS["ai-search"]);
    tap = createAuditTap({ endpoint: "/api/ai-search", method: "POST", authCtx, startedAt });

    const rl = await checkRateLimit(authCtx.rateLimitClientKey, authCtx.rateLimitConfig);
    if (!rl.ok) return tap(rateLimitResponse(rl));

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return tap(apiError("SERVICE_UNAVAILABLE", "GEMINI_API_KEY is not configured", 503));
    }

    const parsed = await parseBody(request, AiSearchBodySchema);
    if (!parsed.ok) return tap(parsed.response);
    const { query } = parsed.data;

    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [
        { role: "user", parts: [{ text: query }] },
      ],
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: "application/json",
        temperature: 0.1,
        maxOutputTokens: 512,
      },
    });

    const text = response.text || "";

    let aiJson: Record<string, unknown>;
    try {
      aiJson = JSON.parse(text);
    } catch {
      return tap(apiError("INTERNAL_ERROR", "Failed to parse AI response", 500, { raw: text }));
    }

    // Validate and clean the response
    const validListingTypes = ["sale", "rent", "auction", "shares", "project"];
    const validCategories = ["apartment", "house", "land", "commercial", "other"];

    const filters: Record<string, unknown> = {};

    if (typeof aiJson.listingType === "string" && validListingTypes.includes(aiJson.listingType)) {
      filters.listingType = aiJson.listingType;
    }
    if (typeof aiJson.category === "string" && validCategories.includes(aiJson.category)) {
      filters.category = aiJson.category;
    }
    if (Array.isArray(aiJson.subtypes) && aiJson.subtypes.length > 0) {
      filters.subtypes = aiJson.subtypes.filter((s: unknown) => typeof s === "string");
    }
    if (typeof aiJson.city === "string") {
      filters.city = aiJson.city;
    }
    if (typeof aiJson.country === "string") {
      filters.country = aiJson.country;
    }
    if (typeof aiJson.priceMin === "number" && aiJson.priceMin > 0) {
      filters.priceMin = aiJson.priceMin;
    }
    if (typeof aiJson.priceMax === "number" && aiJson.priceMax > 0) {
      filters.priceMax = aiJson.priceMax;
    }
    if (typeof aiJson.areaMin === "number" && aiJson.areaMin > 0) {
      filters.areaMin = aiJson.areaMin;
    }
    if (typeof aiJson.areaMax === "number" && aiJson.areaMax > 0) {
      filters.areaMax = aiJson.areaMax;
    }

    return tap(NextResponse.json(
      {
        filters,
        explanation: typeof aiJson.explanation === "string" ? aiJson.explanation : "",
      },
      { headers: rateLimitHeaders(rl) },
    ));
  } catch (err) {
    console.error("AI search error:", err);
    return tap(apiError("INTERNAL_ERROR", "AI search failed", 500));
  }
}
