import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { PDFDocument, rgb } from "pdf-lib";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import fontkit from "@pdf-lib/fontkit";
import fs from "fs/promises";
import path from "path";

const REPORT_PRICE_CREDITS = 50;

const BRAND = {
  accent: rgb(1, 0.722, 0),        // #FFB800
  accentDark: rgb(0.8, 0.58, 0),   // darker yellow for text
  text: rgb(0.12, 0.12, 0.12),
  textMuted: rgb(0.45, 0.47, 0.5),
  textLight: rgb(0.62, 0.64, 0.67),
  border: rgb(0.88, 0.89, 0.9),
  bgLight: rgb(0.97, 0.97, 0.96),
  white: rgb(1, 1, 1),
  black: rgb(0, 0, 0),
};

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
    const geminiText = await generateGeminiCommentary(params, valuation);

    // ── 4. Build report_data snapshot (comprehensive) ──
    const v = (k: string) => valuation[k] ?? valuation[k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())] ?? 0;
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
        avg_price: v("avg_price"),
        min_price: v("min_price"),
        max_price: v("max_price"),
        avg_price_m2: v("avg_price_m2"),
        min_price_m2: v("min_price_m2"),
        max_price_m2: v("max_price_m2"),
        std_price_m2: v("std_price_m2"),
        range_price: valuation.range_price ?? valuation.rangePrice ?? [0, 0],
        range_price_m2: valuation.range_price_m2 ?? valuation.rangePriceM2 ?? [0, 0],
        calc_area: v("calc_area") || params.floorArea || 0,
        currency: valuation.currency ?? "CZK",
        as_of: valuation.as_of ?? valuation.asOf ?? new Date().toISOString().slice(0, 10),
        avg_score: v("avg_score"),
        avg_distance: v("avg_distance"),
        avg_age: v("avg_age"),
        avg_duration: v("avg_duration"),
        distance: v("distance"),
        keep_ids_count: v("keep_ids_count"),
      },
      cadastre: {
        cadastralArea: cadastre.cadastralArea || null,
        parcelNumber: cadastre.parcelNumber || null,
        address: ruian?.adresniMisto ? `${params.address}` : null,
        postalCode: ruian?.adresniMisto?.psc || null,
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
    const pdfBuffer = await generatePDF(reportData);

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
          region: "auto",
          endpoint: r2Endpoint,
          credentials: { accessKeyId: r2AccessKey, secretAccessKey: r2SecretKey },
        });
        const key = `reports/valuation-${valuationId}-${Date.now()}.pdf`;
        await r2.send(new PutObjectCommand({
          Bucket: r2Bucket,
          Key: key,
          Body: pdfBuffer,
          ContentType: "application/pdf",
          CacheControl: "public, max-age=31536000, immutable",
        }));
        pdfUrl = r2PublicUrl ? `${r2PublicUrl}/${key}` : key;
        console.log("[valuation/report] PDF uploaded:", pdfUrl);
      } catch (e) {
        console.error("[valuation/report] R2 upload error:", e);
      }
    } else {
      console.warn("[valuation/report] R2 not configured — missing env vars",
        { hasAccountId: !!r2AccountId, hasAccessKey: !!r2AccessKey, hasSecretKey: !!r2SecretKey });
    }

    // ── 7. Update DB ──
    await client.from("valuation_reports").update({
      gemini_text: geminiText, report_data: reportData, report_version: 1,
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
): Promise<string> {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) return "AI komentář není k dispozici.";

  const avgPrice = Number(valuation.avg_price ?? valuation.avgPrice ?? 0);
  const avgPriceM2 = Number(valuation.avg_price_m2 ?? valuation.avgPriceM2 ?? 0);
  const minPrice = Number(valuation.min_price ?? valuation.minPrice ?? 0);
  const maxPrice = Number(valuation.max_price ?? valuation.maxPrice ?? 0);

  const typeMap: Record<string, string> = { flat: "byt", house: "dům", land: "pozemek" };
  const prompt = `Jsi profesionální odhadce nemovitostí v České republice. Napiš krátký, věcný a profesionální komentář k ocenění nemovitosti v češtině (max 200 slov). Nepoužívej emotikony.

Údaje o nemovitosti:
- Typ: ${typeMap[String(params.propertyType)] || params.propertyType}
- Adresa: ${params.address || "neuvedena"}
- Město: ${params.city || "neuvedeno"}
- Dispozice: ${params.localType || params.disposition || "neuvedena"}
- Plocha: ${params.floorArea || "neuvedena"} m²
- Stav: ${params.rating || params.condition || "neuvedeno"}

Výsledek ocenění:
- Odhadovaná cena: ${avgPrice.toLocaleString("cs")} Kč
- Rozsah: ${minPrice.toLocaleString("cs")} – ${maxPrice.toLocaleString("cs")} Kč
- Cena za m²: ${avgPriceM2.toLocaleString("cs")} Kč/m²

Struktura: 1) Zhodnocení ceny ve vztahu k lokalitě 2) Faktory ovlivňující cenu 3) Doporučení`;

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

// ═══════════════════════════════════════════════════════════════
// PDF Generation — Professional Valuation Report
// ═══════════════════════════════════════════════════════════════
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function generatePDF(data: any): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  const fontBytes = await fs.readFile(path.join(process.cwd(), "public/fonts/Roboto-Regular.ttf"));
  const fontBoldBytes = await fs.readFile(path.join(process.cwd(), "public/fonts/Roboto-Bold.ttf"));
  const font = await pdfDoc.embedFont(fontBytes);
  const fontBold = await pdfDoc.embedFont(fontBoldBytes);

  let logoImage = null;
  try { logoImage = await pdfDoc.embedPng(await fs.readFile(path.join(process.cwd(), "public/branding/nemovizor_logo.png"))); } catch { /* */ }

  const W = 595; const H = 842; // A4
  const ML = 45; const MR = 550; const CW = MR - ML;
  const fmtP = (n: number) => n ? `${Math.round(n).toLocaleString("cs")} Kč` : "—";
  const fmtPm2 = (n: number) => n ? `${Math.round(n).toLocaleString("cs")} Kč/m²` : "—";
  const prop = data.property || {};
  const val = data.valuation || {};
  const cad = data.cadastre || {};
  const contact = data.contact || {};

  const typeLabels: Record<string, string> = { flat: "Byt", house: "Dům", land: "Pozemek" };
  const condLabels: Record<string, string> = { excellent: "Luxusní/novostavba", very_good: "Po rekonstrukci", good: "Průměrný", nothing_much: "Před rekonstrukcí", bad: "Neobyvatelný", new: "Novostavba" };
  const ownLabels: Record<string, string> = { private: "Osobní", cooperative: "Družstevní", council: "Státní/obecní" };

  // ── Fetch static map image ──
  let mapImage = null;
  if (prop.lat && prop.lng) {
    try {
      const mapUrl = `https://api.mapy.cz/v1/static?lon=${prop.lng}&lat=${prop.lat}&zoom=15&width=500&height=200&marker=true&apikey=${process.env.NEXT_PUBLIC_MAPY_API_KEY || ""}`;
      const mapResp = await fetch(mapUrl, { signal: AbortSignal.timeout(8000) });
      if (mapResp.ok) {
        const mapBuf = Buffer.from(await mapResp.arrayBuffer());
        if (mapBuf.length > 1000) {
          mapImage = await pdfDoc.embedPng(mapBuf).catch(() => null);
          if (!mapImage) mapImage = await pdfDoc.embedJpg(mapBuf).catch(() => null);
        }
      }
    } catch { /* map optional */ }
  }

  // ── Price scale visualization helper ──
  const drawPriceScale = (pg: typeof page2, x: number, yy: number, w: number) => {
    const minP = val.min_price || 0;
    const maxP = val.max_price || 1;
    const avgP = val.avg_price || 0;
    const rMin = (val.range_price || [0, 0])[0];
    const rMax = (val.range_price || [0, 0])[1];
    if (!minP || !maxP) return yy;

    const barH = 14;
    const totalRange = maxP - minP;

    // Full range bar (light)
    pg.drawRectangle({ x, y: yy, width: w, height: barH, color: rgb(0.92, 0.93, 0.94) });

    // Percentile range (medium)
    const pctStart = ((rMin - minP) / totalRange) * w;
    const pctEnd = ((rMax - minP) / totalRange) * w;
    pg.drawRectangle({ x: x + pctStart, y: yy, width: Math.max(pctEnd - pctStart, 4), height: barH, color: rgb(1, 0.86, 0.4) });

    // Average marker (triangle/line)
    const avgX = x + ((avgP - minP) / totalRange) * w;
    pg.drawRectangle({ x: avgX - 1.5, y: yy - 2, width: 3, height: barH + 4, color: rgb(0.93, 0.26, 0.14) });

    // Labels
    pg.drawText(fmtP(minP), { x, y: yy - 13, size: 7, font, color: BRAND.textMuted });
    pg.drawText(fmtP(avgP), { x: avgX - 20, y: yy + barH + 4, size: 7.5, font: fontBold, color: rgb(0.93, 0.26, 0.14) });
    drawRight(pg, fmtP(maxP), x + w, yy - 13, font, 7, BRAND.textMuted);

    // Legend
    pg.drawRectangle({ x, y: yy - 26, width: 10, height: 6, color: rgb(0.92, 0.93, 0.94) });
    pg.drawText("Min–Max", { x: x + 14, y: yy - 25, size: 6.5, font, color: BRAND.textLight });
    pg.drawRectangle({ x: x + 70, y: yy - 26, width: 10, height: 6, color: rgb(1, 0.86, 0.4) });
    pg.drawText("25.–75. percentil", { x: x + 84, y: yy - 25, size: 6.5, font, color: BRAND.textLight });
    pg.drawRectangle({ x: x + 175, y: yy - 26, width: 3, height: 6, color: rgb(0.93, 0.26, 0.14) });
    pg.drawText("Průměr", { x: x + 182, y: yy - 25, size: 6.5, font, color: BRAND.textLight });

    return yy - 36;
  };

  // Helper functions
  type FontType = typeof font;
  const drawRight = (pg: typeof page, text: string, x: number, yy: number, f: FontType, s: number, c: typeof BRAND.text) => {
    pg.drawText(text, { x: x - f.widthOfTextAtSize(text, s), y: yy, size: s, font: f, color: c });
  };
  const wrap = (text: string, maxW: number, f: FontType, s: number): string[] => {
    const words = text.split(" "); const lines: string[] = []; let line = "";
    for (const w of words) { const t = line ? `${line} ${w}` : w; if (f.widthOfTextAtSize(t, s) > maxW) { if (line) lines.push(line); line = w; } else { line = t; } }
    if (line) lines.push(line); return lines;
  };
  const drawRow = (pg: typeof page, label: string, value: string, yy: number, lx: number = ML, vx: number = ML + 120) => {
    pg.drawText(label, { x: lx, y: yy, size: 9, font, color: BRAND.textMuted });
    pg.drawText(value, { x: vx, y: yy, size: 9.5, font, color: BRAND.text });
  };
  // Score bar helper
  const drawScoreBar = (pg: typeof page, x: number, yy: number, w: number, pct: number, label: string) => {
    pg.drawRectangle({ x, y: yy, width: w, height: 8, color: BRAND.border });
    const barColor = pct >= 70 ? rgb(0.13, 0.73, 0.38) : pct >= 40 ? rgb(1, 0.76, 0) : rgb(0.93, 0.26, 0.14);
    pg.drawRectangle({ x, y: yy, width: Math.max(w * (pct / 100), 2), height: 8, color: barColor });
    pg.drawText(`${label}: ${pct}%`, { x, y: yy - 11, size: 7.5, font, color: BRAND.textMuted });
  };

  // ═══════════════════════════════════════════════════════════════
  // PAGE 1: Main valuation
  // ═══════════════════════════════════════════════════════════════
  const page = pdfDoc.addPage([W, H]);
  let y = H - 40;

  // ── HEADER ──
  page.drawRectangle({ x: 0, y: H - 50, width: W, height: 50, color: BRAND.accent });
  if (logoImage) {
    const lh = 24; page.drawImage(logoImage, { x: ML, y: H - 50 + (50 - lh) / 2, width: lh * (logoImage.width / logoImage.height), height: lh });
  } else {
    page.drawText("NEMOVIZOR", { x: ML, y: H - 36, size: 20, font: fontBold, color: BRAND.black });
  }
  page.drawText("Orientační ocenění nemovitosti", { x: ML, y: H - 46, size: 9, font, color: rgb(0.3, 0.24, 0) });
  drawRight(page, data.generated_at?.slice(0, 10) || "", MR, H - 36, font, 9, rgb(0.3, 0.24, 0));

  y = H - 72;

  // ── PROPERTY INFO ──
  page.drawText("Nemovitost", { x: ML, y, size: 12, font: fontBold, color: BRAND.text }); y -= 18;

  const rows = ([
    ["Adresa", prop.address],
    ["Město", prop.city],
    ["Typ nemovitosti", typeLabels[prop.type] || prop.type],
    ["Dispozice", prop.disposition],
    ["Užitná plocha", prop.area ? `${prop.area} m²` : null],
    ["Plocha pozemku", prop.lotArea ? `${prop.lotArea} m²` : null],
    ["Stav", condLabels[prop.condition] || prop.condition],
    ["Vlastnictví", ownLabels[prop.ownership] || prop.ownership],
    ["Patro / Podlaží", prop.floor ? `${prop.floor}. patro z ${prop.totalFloors || "?"}` : null],
    ["Energetický štítek", prop.energyRating],
    ["GPS souřadnice", prop.lat ? `${Number(prop.lat).toFixed(5)}, ${Number(prop.lng).toFixed(5)}` : null],
  ] as [string, string | null][]).filter(([, v]) => v);

  for (const [label, value] of rows) {
    drawRow(page, label, value!, y); y -= 15;
  }

  y -= 12;

  // ── MAP IMAGE ──
  if (mapImage && y > 220) {
    const mapW = CW;
    const mapH = Math.min(mapW * (200 / 500), 160);
    page.drawRectangle({ x: ML, y: y - mapH - 2, width: mapW, height: mapH + 4, color: BRAND.border }); // border
    page.drawImage(mapImage, { x: ML + 2, y: y - mapH, width: mapW - 4, height: mapH });
    y -= mapH + 12;
  }

  // ── VALUATION BOX ──
  const vBoxH = 110;
  page.drawRectangle({ x: ML, y: y - vBoxH + 10, width: CW, height: vBoxH, color: BRAND.bgLight });
  page.drawRectangle({ x: ML, y: y - vBoxH + 10, width: 4, height: vBoxH, color: BRAND.accent });

  const vY = y;
  page.drawText("Výsledek ocenění", { x: ML + 14, y: vY, size: 10, font: fontBold, color: BRAND.textMuted });
  page.drawText(fmtP(val.avg_price), { x: ML + 14, y: vY - 28, size: 28, font: fontBold, color: BRAND.text });
  page.drawText("odhadovaná tržní cena", { x: ML + 14, y: vY - 42, size: 8.5, font, color: BRAND.textMuted });

  // Score bar
  const score = Math.round((val.avg_score || 0) * 100);
  drawScoreBar(page, ML + 14, vY - 60, 180, score, "Kvalita odhadu");

  // Right column
  const rx = ML + CW / 2 + 10;
  page.drawText("Rozsah ceny", { x: rx, y: vY - 2, size: 8, font, color: BRAND.textMuted });
  page.drawText(`${fmtP(val.min_price)} – ${fmtP(val.max_price)}`, { x: rx, y: vY - 16, size: 11, font: fontBold, color: BRAND.text });

  page.drawText("Cenové pásmo (25.–75. percentil)", { x: rx, y: vY - 32, size: 8, font, color: BRAND.textMuted });
  const rp = val.range_price || [0, 0];
  page.drawText(`${fmtP(rp[0])} – ${fmtP(rp[1])}`, { x: rx, y: vY - 44, size: 10, font, color: BRAND.text });

  page.drawText("Cena za m²", { x: rx, y: vY - 60, size: 8, font, color: BRAND.textMuted });
  page.drawText(fmtPm2(val.avg_price_m2), { x: rx, y: vY - 73, size: 11, font: fontBold, color: BRAND.text });

  const rpm2 = val.range_price_m2 || [0, 0];
  page.drawText(`Rozsah: ${fmtPm2(rpm2[0])} – ${fmtPm2(rpm2[1])}`, { x: rx, y: vY - 86, size: 8, font, color: BRAND.textMuted });

  y -= vBoxH + 15;

  // ── DETAILED METRICS ──
  page.drawText("Detailní metriky", { x: ML, y, size: 11, font: fontBold, color: BRAND.text }); y -= 16;

  const metrics = ([
    ["Min. cena za m²", fmtPm2(val.min_price_m2)],
    ["Max. cena za m²", fmtPm2(val.max_price_m2)],
    ["Směrodatná odchylka", val.std_price_m2 ? `${Math.round(val.std_price_m2).toLocaleString("cs")} Kč/m²` : null],
    ["Započítaná plocha", val.calc_area ? `${val.calc_area} m²` : null],
    ["Porovnáno nemovitostí", val.keep_ids_count ? `${val.keep_ids_count} ks` : null],
    ["Průměrná vzdálenost", val.avg_distance ? `${Math.round(val.avg_distance)} m` : null],
    ["Radius porovnání", val.distance ? `${val.distance} m` : null],
    ["Prům. stáří dat", val.avg_age ? `${Math.round(val.avg_age)} dní` : null],
    ["Prům. doba inzerce", val.avg_duration ? `${Math.round(val.avg_duration)} dní` : null],
    ["Datum výpočtu", val.as_of ? String(val.as_of).slice(0, 10) : null],
    ["Měna", val.currency || "CZK"],
  ] as [string, string | null][]).filter(([, v]) => v);

  const halfIdx = Math.ceil(metrics.length / 2);
  for (let i = 0; i < halfIdx; i++) {
    const [l1, v1] = metrics[i];
    drawRow(page, l1, v1!, y, ML, ML + 110);
    if (metrics[i + halfIdx]) {
      const [l2, v2] = metrics[i + halfIdx];
      drawRow(page, l2, v2!, y, ML + CW / 2, ML + CW / 2 + 110);
    }
    y -= 14;
  }

  y -= 12;

  // ── CADASTRE ──
  const hasCadastre = cad.cadastralArea || cad.parcelNumber || cad.building || cad.parcel;
  if (hasCadastre) {
    page.drawText("Katastrální údaje (RÚIAN)", { x: ML, y, size: 11, font: fontBold, color: BRAND.text }); y -= 16;

    const cadRows = ([
      ["Katastrální území", cad.cadastralArea || cad.parcel?.cadastralName],
      ["Parcela", cad.parcelNumber || cad.parcel?.number],
      ["Kód k. ú.", cad.parcel?.cadastralCode ? String(cad.parcel.cadastralCode) : null],
      ["Počet podlaží", cad.building?.floors ? String(cad.building.floors) : null],
      ["Počet bytů", cad.building?.units ? String(cad.building.units) : null],
      ["Konstrukce", cad.building?.construction],
      ["Datum dokončení", cad.building?.completionDate ? String(cad.building.completionDate).slice(0, 10) : null],
    ] as [string, string | null][]).filter(([, v]) => v);

    for (const [label, value] of cadRows) {
      drawRow(page, label, value!, y); y -= 14;
    }

    // Building age analysis
    if (cad.building?.completionDate) {
      const completionYear = new Date(cad.building.completionDate).getFullYear();
      const age = new Date().getFullYear() - completionYear;
      const lifespan = 100;
      const remaining = Math.max(lifespan - age, 0);
      const pct = Math.round((remaining / lifespan) * 100);

      y -= 6;
      page.drawText(`Stáří budovy: ${age} let (rok ${completionYear})`, { x: ML, y, size: 8.5, font: fontBold, color: BRAND.text }); y -= 12;
      page.drawText(`Zbývající životnost: ${remaining} let (${pct}%)`, { x: ML, y, size: 8, font, color: BRAND.textMuted });
      drawScoreBar(page, ML + 200, y - 2, 120, pct, "Životnost");
      y -= 20;
    }
    y -= 8;
  }

  // ═══════════════════════════════════════════════════════════════
  // PAGE 2: AI Commentary + CTA
  // ═══════════════════════════════════════════════════════════════
  const page2 = pdfDoc.addPage([W, H]);
  y = H - 50;

  // Header stripe
  page2.drawRectangle({ x: 0, y: H - 6, width: W, height: 6, color: BRAND.accent });

  // ── PRICE SCALE VISUALIZATION ──
  page2.drawText("Cenová škála", { x: ML, y, size: 12, font: fontBold, color: BRAND.text }); y -= 8;
  page2.drawRectangle({ x: ML, y, width: 40, height: 2, color: BRAND.accent }); y -= 18;
  y = drawPriceScale(page2, ML, y, CW);
  y -= 15;

  // ── PRICE PER M2 SCALE ──
  if (val.min_price_m2 && val.max_price_m2) {
    page2.drawText("Cena za m² — srovnání", { x: ML, y, size: 10, font: fontBold, color: BRAND.text }); y -= 16;

    const m2Min = val.min_price_m2;
    const m2Max = val.max_price_m2;
    const m2Avg = val.avg_price_m2;
    const m2Range = m2Max - m2Min || 1;
    const barW = CW; const barH = 10;

    page2.drawRectangle({ x: ML, y, width: barW, height: barH, color: rgb(0.92, 0.93, 0.94) });

    // Range band
    const rm2 = val.range_price_m2 || [0, 0];
    if (rm2[0] && rm2[1]) {
      const s = ((rm2[0] - m2Min) / m2Range) * barW;
      const e = ((rm2[1] - m2Min) / m2Range) * barW;
      page2.drawRectangle({ x: ML + s, y, width: Math.max(e - s, 4), height: barH, color: rgb(0.6, 0.85, 0.65) });
    }

    // Average marker
    const avgX = ML + ((m2Avg - m2Min) / m2Range) * barW;
    page2.drawRectangle({ x: avgX - 1.5, y: y - 2, width: 3, height: barH + 4, color: rgb(0.13, 0.55, 0.28) });

    page2.drawText(fmtPm2(m2Min), { x: ML, y: y - 14, size: 7, font, color: BRAND.textMuted });
    page2.drawText(fmtPm2(m2Avg), { x: avgX - 25, y: y + barH + 4, size: 7.5, font: fontBold, color: rgb(0.13, 0.55, 0.28) });
    drawRight(page2, fmtPm2(m2Max), ML + barW, y - 14, font, 7, BRAND.textMuted);

    y -= 32;
  }

  y -= 10;

  // AI Commentary
  if (data.ai_commentary) {
    page2.drawText("Odborný komentář", { x: ML, y, size: 12, font: fontBold, color: BRAND.text }); y -= 8;
    page2.drawRectangle({ x: ML, y, width: 60, height: 2, color: BRAND.accent }); y -= 16;

    const cleanText = data.ai_commentary.replace(/\*\*/g, "").replace(/\*/g, "").replace(/#{1,3}\s/g, "").replace(/\n{2,}/g, "\n").trim();
    for (const para of cleanText.split("\n")) {
      if (!para.trim()) { y -= 6; continue; }
      for (const line of wrap(para.trim(), CW, font, 9.5)) {
        if (y < 60) { /* Would need page 3 — skip for now */ break; }
        page2.drawText(line, { x: ML, y, size: 9.5, font, color: BRAND.text });
        y -= 14;
      }
      y -= 4;
    }
    y -= 15;
  }

  // ── CTA BOX — Free expert consultation ──
  const ctaH = 90;
  if (y > ctaH + 60) {
    page2.drawRectangle({ x: ML, y: y - ctaH, width: CW, height: ctaH, color: rgb(0.98, 0.96, 0.9) });
    page2.drawRectangle({ x: ML, y: y - ctaH, width: CW, height: 3, color: BRAND.accent });

    page2.drawText("Chcete přesnější ocenění?", { x: ML + 16, y: y - 18, size: 13, font: fontBold, color: BRAND.text });
    page2.drawText("Nabízíme bezplatné posouzení nemovitosti odborníkem zdarma a bez závazků.", { x: ML + 16, y: y - 34, size: 9.5, font, color: BRAND.text });

    const ctaLines = [
      "Individuální přístup s ohledem na specifika vaší nemovitosti",
      "Zohlednění stavu, lokality a aktuální situace na trhu",
      "Doporučení optimální prodejní strategie",
    ];
    let ctaY = y - 50;
    for (const line of ctaLines) {
      page2.drawText(`•  ${line}`, { x: ML + 16, y: ctaY, size: 8.5, font, color: BRAND.textMuted });
      ctaY -= 12;
    }

    y -= ctaH + 15;
  }

  // Contact info
  if (y > 80) {
    page2.drawText("Kontaktujte nás:", { x: ML, y, size: 10, font: fontBold, color: BRAND.text }); y -= 16;
    page2.drawText("nemovizor.cz  |  info@nemovizor.cz  |  +420 774 052 232", { x: ML, y, size: 9, font, color: BRAND.textMuted }); y -= 20;
  }

  // ── DISCLAIMER ──
  page2.drawRectangle({ x: ML, y: 55, width: CW, height: 1, color: BRAND.border });
  const disclaimer = "Tento odhad je orientační a nevytváří závazný znalecký posudek. Odhad vychází z porovnání s realizovanými obchody v okolí a je poskytován bez záruky. Pro závazné účely (hypotéka, soud, financování) doporučujeme nechat zpracovat znalecký posudek soudním znalcem. Nemovizor nenese odpovědnost za rozhodnutí učiněná na základě tohoto odhadu.";
  let dY = 48;
  for (const line of wrap(disclaimer, CW, font, 7)) {
    page2.drawText(line, { x: ML, y: dY, size: 7, font, color: BRAND.textLight });
    dY -= 9;
  }

  // ── FOOTER on all pages ──
  for (let i = 0; i < pdfDoc.getPageCount(); i++) {
    const p = pdfDoc.getPage(i);
    p.drawText("nemovizor.cz", { x: ML, y: 18, size: 7.5, font, color: BRAND.textLight });
    drawRight(p, `${i + 1}/${pdfDoc.getPageCount()}`, MR, 18, font, 7.5, BRAND.textLight);
    // Bottom accent line
    p.drawRectangle({ x: 0, y: 14, width: W, height: 2, color: BRAND.accent });
  }

  return Buffer.from(await pdfDoc.save());
}

// ═══════════════════════════════════════════════════════════════
// R2 Upload
// ═══════════════════════════════════════════════════════════════
async function uploadPdfToR2(buffer: Buffer, valuationId: string): Promise<string> {
  const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
  const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
  const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
  const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || "nemovizor-media";
  const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || "";
  const R2_ENDPOINT = process.env.R2_ENDPOINT || `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    console.warn("[valuation/report] R2 not configured");
    return "";
  }

  const r2 = new S3Client({
    region: "auto", endpoint: R2_ENDPOINT,
    credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
  });

  const key = `reports/valuation-${valuationId}-${Date.now()}.pdf`;
  await r2.send(new PutObjectCommand({
    Bucket: R2_BUCKET_NAME, Key: key, Body: buffer,
    ContentType: "application/pdf",
    CacheControl: "public, max-age=31536000, immutable",
  }));

  return R2_PUBLIC_URL ? `${R2_PUBLIC_URL}/${key}` : key;
}
