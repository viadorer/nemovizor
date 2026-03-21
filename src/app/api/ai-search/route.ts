import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

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
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY is not configured" },
        { status: 503 }
      );
    }

    const body = await request.json();
    const query = body.query?.trim();

    if (!query || query.length < 3) {
      return NextResponse.json(
        { error: "Query too short" },
        { status: 400 }
      );
    }

    if (query.length > 500) {
      return NextResponse.json(
        { error: "Query too long" },
        { status: 400 }
      );
    }

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

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      return NextResponse.json(
        { error: "Failed to parse AI response", raw: text },
        { status: 500 }
      );
    }

    // Validate and clean the response
    const validListingTypes = ["sale", "rent", "auction", "shares", "project"];
    const validCategories = ["apartment", "house", "land", "commercial", "other"];

    const filters: Record<string, unknown> = {};

    if (parsed.listingType && validListingTypes.includes(parsed.listingType)) {
      filters.listingType = parsed.listingType;
    }
    if (parsed.category && validCategories.includes(parsed.category)) {
      filters.category = parsed.category;
    }
    if (parsed.subtypes && Array.isArray(parsed.subtypes) && parsed.subtypes.length > 0) {
      filters.subtypes = parsed.subtypes.filter((s: unknown) => typeof s === "string");
    }
    if (parsed.city && typeof parsed.city === "string") {
      filters.city = parsed.city;
    }
    if (parsed.country && typeof parsed.country === "string") {
      filters.country = parsed.country;
    }
    if (parsed.priceMin && typeof parsed.priceMin === "number" && parsed.priceMin > 0) {
      filters.priceMin = parsed.priceMin;
    }
    if (parsed.priceMax && typeof parsed.priceMax === "number" && parsed.priceMax > 0) {
      filters.priceMax = parsed.priceMax;
    }
    if (parsed.areaMin && typeof parsed.areaMin === "number" && parsed.areaMin > 0) {
      filters.areaMin = parsed.areaMin;
    }
    if (parsed.areaMax && typeof parsed.areaMax === "number" && parsed.areaMax > 0) {
      filters.areaMax = parsed.areaMax;
    }

    return NextResponse.json({
      filters,
      explanation: parsed.explanation || "",
    });
  } catch (err) {
    console.error("AI search error:", err);
    return NextResponse.json(
      { error: "AI search failed" },
      { status: 500 }
    );
  }
}
