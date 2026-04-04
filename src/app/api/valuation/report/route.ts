import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { generateValuationPDF } from "@/lib/pdf-valuation";

const REPORT_PRICE_CREDITS = 50;

/**
 * POST /api/valuation/report
 * Generates PDF valuation report with Gemini AI commentary.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { valuationId, userId, skipPayment } = body;

    if (!valuationId) {
      return NextResponse.json({ error: "valuationId required" }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = getSupabase() as any;
    if (!client) return NextResponse.json({ error: "No DB" }, { status: 503 });

    // ── 1. Load valuation report ──
    const { data: report, error: loadErr } = await client
      .from("valuation_reports")
      .select("*")
      .eq("id", valuationId)
      .single();

    if (loadErr || !report) {
      return NextResponse.json({ error: "Ocenění nenalezeno" }, { status: 404 });
    }

    // ── 2. Payment check ──
    if (!skipPayment && userId) {
      const { data: wallet } = await client
        .from("wallets")
        .select("id, credits")
        .eq("user_id", userId)
        .single();

      if (!wallet || wallet.credits < REPORT_PRICE_CREDITS) {
        return NextResponse.json({
          error: "Nedostatek kreditů",
          required: REPORT_PRICE_CREDITS,
          balance: wallet?.credits ?? 0,
        }, { status: 402 });
      }

      const newBalance = wallet.credits - REPORT_PRICE_CREDITS;
      await client.from("wallets").update({ credits: newBalance }).eq("id", wallet.id);
      await client.from("wallet_transactions").insert({
        wallet_id: wallet.id, type: "debit", amount: REPORT_PRICE_CREDITS,
        credits: REPORT_PRICE_CREDITS, balance_before: wallet.credits, balance_after: newBalance,
        category: "service_purchase",
        description: `PDF report ocenění — ${report.property_params?.address || "nemovitost"}`,
        reference_type: "valuation_report", created_by: userId,
      });
    }

    // ── 3. Generate AI commentary ──
    const valuation = report.valuo_response || {};
    const params = report.property_params || {};
    const cadastreRaw = report.cadastre_data || {};
    const geminiText = await generateGeminiCommentary(params, valuation, cadastreRaw);

    // ── 4. Build report_data ──
    const v = (k: string) => valuation[k] ?? valuation[k.replace(/_([a-z])/g, (_: string, c: string) => c.toUpperCase())] ?? 0;
    const cadastre = report.cadastre_data || {};
    const ruian = cadastre.ruianData || {};

    const reportData = {
      version: 2,
      generated_at: new Date().toISOString(),
      contact: {
        name: `${params.name || ""} ${params.lastName || ""}`.trim(),
        email: report.email || "",
        phone: params.phone || "",
      },
      property: {
        address: params.address || "", city: params.city || "",
        lat: params.lat || 0, lng: params.lng || 0,
        type: params.propertyType || "flat",
        area: params.floorArea || 0, lotArea: params.lotArea || 0,
        disposition: params.localType || params.disposition || "",
        condition: params.rating || params.condition || "",
        floor: params.floor || null, totalFloors: params.totalFloors || null,
        ownership: params.ownership || "private",
        energyRating: params.energyPerformance || null,
        houseType: params.houseType || null,
      },
      valuation: {
        avg_price: v("avg_price"), min_price: v("min_price"), max_price: v("max_price"),
        avg_price_m2: v("avg_price_m2"), min_price_m2: v("min_price_m2"), max_price_m2: v("max_price_m2"),
        std_price_m2: v("std_price_m2"),
        range_price: valuation.range_price ?? valuation.rangePrice ?? [0, 0],
        range_price_m2: valuation.range_price_m2 ?? valuation.rangePriceM2 ?? [0, 0],
        calc_area: v("calc_area") || params.floorArea || 0,
        currency: valuation.currency ?? "CZK",
        as_of: valuation.as_of ?? valuation.asOf ?? new Date().toISOString().slice(0, 10),
        avg_score: v("avg_score"), avg_distance: v("avg_distance"),
        avg_age: v("avg_age"), avg_duration: v("avg_duration"),
        distance: v("distance"), keep_ids_count: v("keep_ids_count"),
      },
      cadastre: {
        cadastralArea: cadastre.cadastralArea || null,
        parcelNumber: cadastre.parcelNumber || null,
        building: ruian?.stavebniObjekt ? {
          floors: ruian.stavebniObjekt.pocetPodlazi || null,
          units: ruian.stavebniObjekt.pocetBytu || null,
          construction: ruian.stavebniObjekt.druhKonstrukce || null,
          completionDate: ruian.stavebniObjekt.datumDokonceni || null,
        } : null,
        parcel: ruian?.parcela ? {
          number: ruian.parcela.kmenoveCislo + (ruian.parcela.poddeleniCisla ? `/${ruian.parcela.poddeleniCisla}` : ""),
          cadastralCode: ruian.parcela.kodKatastralnihoUzemi || null,
          cadastralName: ruian.parcela.nazevKatastralnihoUzemi || null,
        } : null,
      },
      ai_commentary: geminiText,
      branding: { name: "Nemovizor", color: "#FFB800", url: "https://nemovizor.cz" },
    };

    // ── 5. Generate PDF ──
    const pdfBuffer = await generateValuationPDF(reportData);

    // ── 6. Upload to R2 ──
    let pdfUrl = "";
    const r2AccountId = process.env.R2_ACCOUNT_ID || "";
    const r2AccessKey = process.env.R2_ACCESS_KEY_ID || "";
    const r2SecretKey = process.env.R2_SECRET_ACCESS_KEY || "";
    const r2Bucket = process.env.R2_BUCKET_NAME || "nemovizor-media";
    const r2PublicUrl = process.env.R2_PUBLIC_URL || "";
    const r2Endpoint = process.env.R2_ENDPOINT || `https://${r2AccountId}.r2.cloudflarestorage.com`;

    if (r2AccountId && r2AccessKey && r2SecretKey) {
      try {
        const r2 = new S3Client({
          region: "auto", endpoint: r2Endpoint,
          credentials: { accessKeyId: r2AccessKey, secretAccessKey: r2SecretKey },
        });
        const key = `reports/valuation-${valuationId}-${Date.now()}.pdf`;
        await r2.send(new PutObjectCommand({
          Bucket: r2Bucket, Key: key, Body: pdfBuffer,
          ContentType: "application/pdf",
          CacheControl: "public, max-age=31536000, immutable",
        }));
        pdfUrl = r2PublicUrl ? `${r2PublicUrl}/${key}` : key;
      } catch (e) {
        console.error("[valuation/report] R2 upload error:", e);
      }
    } else {
      console.warn("[valuation/report] R2 not configured");
    }

    // ── 7. Update DB ──
    await client.from("valuation_reports").update({
      gemini_text: geminiText, report_data: reportData, report_version: 2,
      pdf_url: pdfUrl, pdf_generated_at: new Date().toISOString(),
      paid: !skipPayment, amount_paid: skipPayment ? 0 : REPORT_PRICE_CREDITS,
      payment_method: skipPayment ? null : "wallet",
    }).eq("id", valuationId);

    return NextResponse.json({ success: true, pdf_url: pdfUrl, report_data: reportData });
  } catch (e) {
    console.error("[valuation/report] Error:", e);
    return NextResponse.json({ error: "Chyba při generování reportu" }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════
// Gemini AI commentary
// ═══════════════════════════════════════════════════════════════
async function generateGeminiCommentary(
  params: Record<string, unknown>,
  valuation: Record<string, unknown>,
  cadastre?: Record<string, unknown>,
): Promise<string> {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) return "AI komentář není k dispozici.";

  const n = (k: string) => Number(valuation[k] ?? valuation[k.replace(/_([a-z])/g, (_: string, c: string) => c.toUpperCase())] ?? 0);
  const typeMap: Record<string, string> = { flat: "byt", house: "dům", land: "pozemek" };
  const condMap: Record<string, string> = { excellent: "luxusní/novostavba", very_good: "po kompletní rekonstrukci", good: "průměrný/dobrý", nothing_much: "před rekonstrukcí", bad: "neobyvatelný", new: "novostavba" };
  const ownMap: Record<string, string> = { private: "osobní", cooperative: "družstevní", council: "státní/obecní" };

  const cad = cadastre || {};
  const building = (cad.building || {}) as Record<string, unknown>;
  const completionYear = building.completionDate ? new Date(String(building.completionDate)).getFullYear() : null;
  const buildingAge = completionYear ? new Date().getFullYear() - completionYear : null;

  const intentMap: Record<string, string> = {
    sell: "vlastník, který zvažuje prodej nemovitosti",
    buy: "zájemce o koupi nemovitosti, který chce vědět zda je cena férová",
    value_check: "vlastník, který chce znát aktuální tržní hodnotu svého majetku",
    inheritance: "osoba řešící dědictví nebo majetkové vypořádání",
    other: "osoba, která se zajímá o hodnotu nemovitosti",
  };
  const clientContext = intentMap[String(params.intent)] || intentMap.other;

  const prompt = `Jsi certifikovaný odhadce nemovitostí v České republice s 20letou praxí. Připrav profesionální písemný komentář k ocenění nemovitosti pro klienta: ${clientContext}.

DŮLEŽITÁ PRAVIDLA:
- Piš v češtině, formálně ale srozumitelně pro laika
- NEPOUŽÍVEJ emotikony, markdown, hvězdičky ani jiné formátování
- NEVYMÝŠLEJ SI žádné informace — používej VÝHRADNĚ data uvedená níže
- Pokud nemáš informaci, napiš "tato informace nebyla poskytnuta" — NIKDY si nevymýšlej
- Všechna čísla a fakta musí odpovídat dodaným datům
- Minimální délka: 800 slov (5 strukturovaných odstavců)

NEMOVITOST:
- Typ: ${typeMap[String(params.propertyType)] || String(params.propertyType)}
- Adresa: ${params.address || "neuvedena"}
- Město/lokalita: ${params.city || "neuvedeno"}
- Dispozice: ${params.localType || params.disposition || "neuvedena"}
- Užitná plocha: ${params.floorArea || "neuvedena"} m²
- Stav nemovitosti: ${condMap[String(params.rating)] || condMap[String(params.condition)] || String(params.rating || params.condition || "neuvedeno")}
- Vlastnictví: ${ownMap[String(params.ownership)] || String(params.ownership || "neuvedeno")}
- Energetický štítek: ${params.energyPerformance || "neuvedeno"}
${params.floor ? `- Patro: ${params.floor}. z ${params.totalFloors || "?"}` : ""}

VÝSLEDEK OCENĚNÍ (z dat realizovaných prodejů):
- Odhadovaná průměrná cena: ${n("avg_price").toLocaleString("cs")} Kč
- Cenový rozsah (min–max): ${n("min_price").toLocaleString("cs")} – ${n("max_price").toLocaleString("cs")} Kč
- Cenové pásmo (25.–75. percentil): ${(valuation.range_price as number[] || [0, 0])[0]?.toLocaleString("cs") || "?"} – ${(valuation.range_price as number[] || [0, 0])[1]?.toLocaleString("cs") || "?"} Kč
- Průměrná cena za m²: ${n("avg_price_m2").toLocaleString("cs")} Kč/m²
- Rozsah ceny za m²: ${n("min_price_m2").toLocaleString("cs")} – ${n("max_price_m2").toLocaleString("cs")} Kč/m²
- Směrodatná odchylka: ${n("std_price_m2").toLocaleString("cs")} Kč/m²
- Kvalita odhadu (skóre podobnosti): ${Math.round(n("avg_score") * 100)}%
- Počet porovnaných nemovitostí: ${n("keep_ids_count")} ks
- Průměrná vzdálenost porovnávaných: ${Math.round(n("avg_distance"))} m
- Průměrné stáří dat: ${Math.round(n("avg_age"))} dní
- Průměrná doba inzerce v okolí: ${Math.round(n("avg_duration"))} dní

${buildingAge ? `ÚDAJE Z KATASTRU (RÚIAN):
- Katastrální území: ${cad.cadastralArea || "neuvedeno"}
- Rok dokončení budovy: ${completionYear}
- Stáří budovy: ${buildingAge} let
- Počet podlaží: ${building.floors || "neuvedeno"}
- Počet bytů v budově: ${building.units || "neuvedeno"}
- Konstrukce: ${building.construction || "neuvedeno"}` : ""}

POŽADOVANÁ STRUKTURA KOMENTÁŘE (min. 800 slov, 5 odstavců):

1. ÚVODNÍ ZHODNOCENÍ (min. 150 slov)
Shrň výsledek ocenění. Uveď konkrétní odhadovanou cenu, cenový rozsah a cenu za m². Porovnej s cenovým pásmem (25.–75. percentil). Vysvětli co znamená kvalita odhadu ${Math.round(n("avg_score") * 100)}% a že odhad je založen na ${n("keep_ids_count")} porovnatelných prodejích v okruhu ${n("distance")} m.

2. ANALÝZA NEMOVITOSTI A LOKALITY (min. 200 slov)
Zhodnoť konkrétní parametry nemovitosti: dispozici ${params.localType || params.disposition || ""}, plochu ${params.floorArea || ""} m², stav "${condMap[String(params.rating)] || String(params.rating || "")}", vlastnictví, energetický štítek ${params.energyPerformance || "neuvedeno"}.
${buildingAge ? `Budova byla dokončena v roce ${completionYear} (stáří ${buildingAge} let), má ${building.floors || "?"} podlaží a ${building.units || "?"} bytových jednotek. Konstrukce: ${building.construction || "neuvedeno"}. Zhodnoť dopad stáří a konstrukce na hodnotu a budoucí náklady.` : ""}
Zhodnoť lokalitu "${params.city || ""}" — obecnou atraktivitu, dopravní dostupnost, charakter okolí. Používej POUZE informace, které vyplývají z dat (adresa, město). NEVYMÝŠLEJ si konkrétní školy, obchody ani zastávky, pokud je neznáš.

3. CENOVÉ SROVNÁNÍ A TRŽNÍ KONTEXT (min. 200 slov)
Cena za m² ${n("avg_price_m2").toLocaleString("cs")} Kč/m² — jak se řadí v rozsahu ${n("min_price_m2").toLocaleString("cs")} – ${n("max_price_m2").toLocaleString("cs")} Kč/m² (směrodatná odchylka ${n("std_price_m2").toLocaleString("cs")} Kč/m²).
Průměrná doba inzerce v okolí je ${Math.round(n("avg_duration"))} dní — vysvětli co to znamená pro prodávajícího (rychlý/pomalý trh). Průměrné stáří porovnávaných dat je ${Math.round(n("avg_age"))} dní — zhodnoť aktuálnost odhadu.
Porovnávané nemovitosti byly v průměrné vzdálenosti ${Math.round(n("avg_distance"))} m — zhodnoť relevanci porovnání.

4. POZITIVNÍ A NEGATIVNÍ FAKTORY (min. 150 slov)
Rozděl na dvě části:
POZITIVNÍ FAKTORY: co zvyšuje hodnotu (vycházej POUZE z dodaných dat — typ, plocha, dispozice, stav, lokalita, vlastnictví)
RIZIKOVÉ FAKTORY: co může snižovat hodnotu nebo představovat riziko
${buildingAge && buildingAge > 30 ? `- Stáří budovy ${buildingAge} let může znamenat vyšší náklady na údržbu` : ""}
${params.energyPerformance && ["E", "F", "G"].includes(String(params.energyPerformance)) ? `- Energetický štítek ${params.energyPerformance} znamená vyšší provozní náklady — zvaž zateplení` : ""}

5. DOPORUČENÍ (min. 150 slov)
Přizpůsob doporučení záměru klienta (${clientContext}):
${String(params.intent) === "sell" ? `- Cenové pásmo pro nabídku: ${(valuation.range_price as number[] || [0, 0])[0]?.toLocaleString("cs") || "?"} – ${(valuation.range_price as number[] || [0, 0])[1]?.toLocaleString("cs") || "?"} Kč (25.–75. percentil realizovaných prodejů)
- Průměrná doba inzerce v okolí je ${Math.round(n("avg_duration"))} dní — zmiň tento údaj jako orientaci
- Doporuč osobní posouzení odborníkem pro přesnější stanovení ceny
- Doporuč profesionální fotografie a kvalitní prezentaci nemovitosti
- NEVYMÝŠLEJ si tipy na renovace ani staging — nemáš informace o aktuálním stavu interiéru` :
String(params.intent) === "buy" ? `- Zhodnoť odhadovanou cenu ve vztahu k parametrům nemovitosti (POUZE na základě dodaných dat)
- Upozorni na faktory, které mohou ovlivnit skutečnou cenu (stav, stáří, energetická náročnost — pouze pokud máš data)
- Doporuč osobní prohlídku a ověření stavu nemovitosti odborníkem
- Doporuč nechat zpracovat znalecký posudek před rozhodnutím o koupi` :
String(params.intent) === "inheritance" ? `- Upozorni, že tento orientační odhad NENÍ znalecký posudek a pro dědické řízení je nutný úřední odhad
- Doporuč nechat zpracovat znalecký posudek soudním znalcem
- Doporuč konzultaci s právníkem nebo notářem ohledně dalších kroků
- NEVYMÝŠLEJ si daňové informace — odkaz na odborného poradce` :
`- Doporučená tržní cena v rámci cenového pásma ${(valuation.range_price as number[] || [0, 0])[0]?.toLocaleString("cs") || "?"} – ${(valuation.range_price as number[] || [0, 0])[1]?.toLocaleString("cs") || "?"} Kč
- Jak tuto informaci využít pro další rozhodování
- Zda doporučuješ nechat zpracovat znalecký posudek
- Doporučení dalších kroků`}`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any

  try {
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    const response = await ai.models.generateContent({ model: "gemini-2.0-flash", contents: prompt });
    return response.text?.trim() || "AI komentář se nepodařilo vygenerovat.";
  } catch (e) {
    console.error("[valuation/report] Gemini error:", e);
    return "AI komentář není momentálně k dispozici.";
  }
}
