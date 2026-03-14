import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

const SYSTEM_PROMPT = `Jsi asistent realitního portálu Nemovizor. Uživatel popíše vlastními slovy, jakou nemovitost hledá. Tvým úkolem je extrahovat strukturované filtry pro vyhledávání.

Vrať JSON objekt s těmito volitelným poli (nezadané vynechej):

{
  "listingType": "sale" | "rent" | "auction" | "shares" | "project",
  "category": "apartment" | "house" | "land" | "commercial" | "other",
  "subtype": string,
  "city": string,
  "priceMin": number,
  "priceMax": number,
  "areaMin": number,
  "areaMax": number,
  "explanation": string
}

Pravidla:
- listingType: "prodej/koupit/koupě" → "sale", "pronájem/nájem/pronajmout" → "rent", "dražba" → "auction"
- category: "byt/apartmán" → "apartment", "dům/vila/chalupa/rodinný" → "house", "pozemek/parcela/zahrada" → "land", "kancelář/sklad/obchod/restaurace" → "commercial"
- subtype pro byty: "1+kk", "1+1", "2+kk", "2+1", "3+kk", "3+1", "4+kk", "4+1", "5+kk", "5+1", "6+", "atypicky", "pokoj"
- subtype pro domy: "rodinny", "vila", "chalupa", "chata", "na_klic", "vicegeneracni"
- subtype pro pozemky: "bydleni", "komercni", "pole", "lesy", "louky", "zahrady"
- subtype pro komerční: "kancelare", "sklady", "vyroba", "obchodni_prostory", "ubytovani", "restaurace"
- city: extrahuj název města v češtině (Praha, Brno, Ostrava, Plzeň, Liberec, Olomouc, České Budějovice, Hradec Králové, Ústí nad Labem, Pardubice, Zlín, Karlovy Vary, ...)
- Ceny jsou v CZK. "5 milionů/5M/5 mega" → 5000000. "do 3M" → priceMax: 3000000. "od 2M" → priceMin: 2000000.
- Plocha v m². "80 metrů/80m2" → 80. "nad 100m2" → areaMin: 100.
- "explanation": krátké shrnutí v češtině co jsi pochopil (1 věta)

Příklady:
- "Byt 3+kk v Praze do 8 milionů" → {"listingType":"sale","category":"apartment","subtype":"3+kk","city":"Praha","priceMax":8000000,"explanation":"Hledáte byt 3+kk k prodeji v Praze do 8 mil. Kč."}
- "Pronájem bytu v Brně od 50m2" → {"listingType":"rent","category":"apartment","city":"Brno","areaMin":50,"explanation":"Hledáte pronájem bytu v Brně od 50 m²."}
- "Rodinný dům s garáží Liberec" → {"listingType":"sale","category":"house","subtype":"rodinny","city":"Liberec","explanation":"Hledáte rodinný dům k prodeji v Liberci."}
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
    if (parsed.subtype && typeof parsed.subtype === "string") {
      filters.subtype = parsed.subtype;
    }
    if (parsed.city && typeof parsed.city === "string") {
      filters.city = parsed.city;
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
