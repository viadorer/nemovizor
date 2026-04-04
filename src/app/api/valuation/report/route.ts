import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { PDFDocument, rgb } from "pdf-lib";
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

    // ── 4. Build report_data snapshot ──
    const reportData = {
      version: 1,
      generated_at: new Date().toISOString(),
      property: {
        address: params.address || "", city: params.city || "",
        lat: params.lat || 0, lng: params.lng || 0,
        type: params.propertyType || "flat",
        area: params.floorArea || 0, lotArea: params.lotArea || 0,
        disposition: params.localType || params.disposition || "",
        condition: params.rating || params.condition || "",
        floor: params.floor || null, totalFloors: params.totalFloors || null,
        ownership: params.ownership || "private",
      },
      valuation: {
        avg_price: valuation.avg_price ?? valuation.avgPrice ?? 0,
        min_price: valuation.min_price ?? valuation.minPrice ?? 0,
        max_price: valuation.max_price ?? valuation.maxPrice ?? 0,
        avg_price_m2: valuation.avg_price_m2 ?? valuation.avgPriceM2 ?? 0,
        range_price: valuation.range_price ?? valuation.rangePrice ?? [0, 0],
        calc_area: valuation.calc_area ?? valuation.calcArea ?? params.floorArea ?? 0,
        currency: valuation.currency ?? "CZK",
        as_of: valuation.as_of ?? valuation.asOf ?? new Date().toISOString().slice(0, 10),
        avg_score: valuation.avg_score ?? valuation.avgScore ?? 0,
      },
      cadastre: report.cadastre_data || null,
      ai_commentary: geminiText,
      branding: { name: "Nemovizor", color: "#FFB800", url: "https://nemovizor.cz" },
    };

    // ── 5. Generate PDF ──
    const pdfBuffer = await generatePDF(reportData);

    // ── 6. Upload to R2 ──
    const pdfUrl = await uploadPdfToR2(pdfBuffer, valuationId);

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
// PDF Generation with pdf-lib + fontkit (Czech diacritics)
// ═══════════════════════════════════════════════════════════════
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function generatePDF(data: any): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  // Load fonts
  const fontPath = path.join(process.cwd(), "public/fonts/Roboto-Regular.ttf");
  const fontBoldPath = path.join(process.cwd(), "public/fonts/Roboto-Bold.ttf");
  const fontBytes = await fs.readFile(fontPath);
  const fontBoldBytes = await fs.readFile(fontBoldPath);
  const font = await pdfDoc.embedFont(fontBytes);
  const fontBold = await pdfDoc.embedFont(fontBoldBytes);

  // Load logo
  let logoImage = null;
  try {
    const logoPath = path.join(process.cwd(), "public/branding/logo-dark.png");
    const logoBytes = await fs.readFile(logoPath);
    logoImage = await pdfDoc.embedPng(logoBytes);
  } catch { /* logo optional */ }

  const page = pdfDoc.addPage([595, 842]); // A4
  const { width, height } = page.getSize();
  const ML = 50; // margin left
  const MR = 545; // margin right
  const CW = MR - ML; // content width
  let y = height - 40;

  const fmtPrice = (n: number) => n ? `${Math.round(n).toLocaleString("cs")} Kč` : "—";

  // Helper: draw right-aligned text
  const drawRight = (text: string, x: number, yPos: number, opts: { font: typeof font; size: number; color: typeof BRAND.text }) => {
    const w = opts.font.widthOfTextAtSize(text, opts.size);
    page.drawText(text, { x: x - w, y: yPos, size: opts.size, font: opts.font, color: opts.color });
  };

  // Helper: wrap text into lines
  const wrapText = (text: string, maxWidth: number, f: typeof font, size: number): string[] => {
    const words = text.split(" ");
    const lines: string[] = [];
    let line = "";
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (f.widthOfTextAtSize(test, size) > maxWidth) {
        if (line) lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines;
  };

  // ══════════════════════════════════════════
  // HEADER — Yellow bar with logo
  // ══════════════════════════════════════════
  const headerH = 55;
  page.drawRectangle({ x: 0, y: height - headerH, width, height: headerH, color: BRAND.accent });

  if (logoImage) {
    const logoH = 28;
    const logoW = logoH * (logoImage.width / logoImage.height);
    page.drawImage(logoImage, { x: ML, y: height - headerH + (headerH - logoH) / 2, width: logoW, height: logoH });
  } else {
    page.drawText("NEMOVIZOR", { x: ML, y: height - 36, size: 22, font: fontBold, color: BRAND.black });
  }

  page.drawText("Ocenění nemovitosti", { x: ML, y: height - headerH + 10, size: 10, font, color: rgb(0.3, 0.24, 0) });
  drawRight(data.generated_at?.slice(0, 10) || "", MR, height - headerH + 10, { font, size: 10, color: rgb(0.3, 0.24, 0) });

  y = height - headerH - 30;

  // ══════════════════════════════════════════
  // PROPERTY INFO
  // ══════════════════════════════════════════
  page.drawText("Nemovitost", { x: ML, y, size: 13, font: fontBold, color: BRAND.text });
  y -= 20;

  const prop = data.property || {};
  const typeLabels: Record<string, string> = { flat: "Byt", house: "Dům", land: "Pozemek" };
  const infoLines = ([
    ["Adresa", prop.address || "—"],
    ["Typ", typeLabels[prop.type] || prop.type || "—"],
    ["Dispozice", prop.disposition || "—"],
    ["Plocha", prop.area ? `${prop.area} m²` : "—"],
    ["Stav", prop.condition || "—"],
    ["Patro", prop.floor ? `${prop.floor}/${prop.totalFloors || "?"}` : "—"],
    ["Vlastnictví", prop.ownership === "private" ? "Osobní" : prop.ownership === "cooperative" ? "Družstevní" : prop.ownership || "—"],
  ] as [string, string][]).filter(([, v]) => v !== "—");

  for (const [label, value] of infoLines) {
    page.drawText(label, { x: ML, y, size: 9.5, font, color: BRAND.textMuted });
    page.drawText(value, { x: ML + 90, y, size: 10, font, color: BRAND.text });
    y -= 16;
  }

  y -= 10;

  // ══════════════════════════════════════════
  // VALUATION RESULT — highlighted box
  // ══════════════════════════════════════════
  const val = data.valuation || {};
  const boxH = 100;
  page.drawRectangle({ x: ML, y: y - boxH + 15, width: CW, height: boxH, color: BRAND.bgLight });
  // Left border accent
  page.drawRectangle({ x: ML, y: y - boxH + 15, width: 4, height: boxH, color: BRAND.accent });

  const boxY = y;
  page.drawText("Výsledek ocenění", { x: ML + 15, y: boxY, size: 11, font: fontBold, color: BRAND.textMuted });

  page.drawText(fmtPrice(val.avg_price), { x: ML + 15, y: boxY - 30, size: 26, font: fontBold, color: BRAND.text });
  page.drawText("odhadovaná tržní cena", { x: ML + 15, y: boxY - 45, size: 9, font, color: BRAND.textMuted });

  // Right column
  const rx = ML + CW / 2 + 10;
  page.drawText("Rozsah ceny", { x: rx, y: boxY, size: 9, font, color: BRAND.textMuted });
  page.drawText(`${fmtPrice(val.min_price)} – ${fmtPrice(val.max_price)}`, { x: rx, y: boxY - 16, size: 12, font: fontBold, color: BRAND.text });

  page.drawText("Cena za m²", { x: rx, y: boxY - 38, size: 9, font, color: BRAND.textMuted });
  page.drawText(`${fmtPrice(val.avg_price_m2)}/m²`, { x: rx, y: boxY - 54, size: 12, font: fontBold, color: BRAND.text });

  page.drawText(`Datum: ${val.as_of || "—"} | Kvalita dat: ${Math.round((val.avg_score || 0) * 100)}%`, {
    x: ML + 15, y: boxY - 72, size: 8, font, color: BRAND.textLight,
  });

  y -= boxH + 15;

  // ══════════════════════════════════════════
  // CADASTRE
  // ══════════════════════════════════════════
  if (data.cadastre) {
    page.drawText("Katastrální údaje", { x: ML, y, size: 11, font: fontBold, color: BRAND.text });
    y -= 16;
    if (data.cadastre.cadastralArea) {
      page.drawText(`Katastrální území: ${data.cadastre.cadastralArea}`, { x: ML, y, size: 9.5, font, color: BRAND.text });
      y -= 14;
    }
    if (data.cadastre.parcelNumber) {
      page.drawText(`Parcela: ${data.cadastre.parcelNumber}`, { x: ML, y, size: 9.5, font, color: BRAND.text });
      y -= 14;
    }
    y -= 10;
  }

  // ══════════════════════════════════════════
  // AI COMMENTARY
  // ══════════════════════════════════════════
  if (data.ai_commentary) {
    page.drawText("Odborný komentář", { x: ML, y, size: 11, font: fontBold, color: BRAND.text });
    y -= 16;

    // Clean markdown formatting
    const cleanText = data.ai_commentary
      .replace(/\*\*/g, "")
      .replace(/\*/g, "")
      .replace(/#{1,3}\s/g, "")
      .replace(/\n{2,}/g, "\n")
      .trim();

    const paragraphs = cleanText.split("\n");
    for (const para of paragraphs) {
      if (!para.trim()) { y -= 6; continue; }
      const lines = wrapText(para.trim(), CW, font, 9);
      for (const line of lines) {
        if (y < 60) {
          // New page
          const newPage = pdfDoc.addPage([595, 842]);
          y = newPage.getSize().height - 50;
          newPage.drawText(line, { x: ML, y, size: 9, font, color: BRAND.text });
        } else {
          page.drawText(line, { x: ML, y, size: 9, font, color: BRAND.text });
        }
        y -= 13;
      }
      y -= 4;
    }
    y -= 10;
  }

  // ══════════════════════════════════════════
  // DISCLAIMER
  // ══════════════════════════════════════════
  if (y < 80) {
    const newPage = pdfDoc.addPage([595, 842]);
    y = newPage.getSize().height - 50;
  }

  page.drawRectangle({ x: ML, y: y - 30, width: CW, height: 1, color: BRAND.border });
  y -= 40;

  const disclaimer = "Tento odhad je orientační a nevytváří závazný znalecký posudek. Odhad vychází z porovnání s realizovanými obchody v okolí a je poskytován bez záruky. Pro závazné účely (hypotéka, soud) doporučujeme znalecký posudek.";
  const discLines = wrapText(disclaimer, CW, font, 7);
  for (const line of discLines) {
    page.drawText(line, { x: ML, y, size: 7, font, color: BRAND.textLight });
    y -= 10;
  }

  // ══════════════════════════════════════════
  // FOOTER on all pages
  // ══════════════════════════════════════════
  const pages = pdfDoc.getPages();
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    p.drawText("nemovizor.cz", { x: ML, y: 25, size: 8, font, color: BRAND.textLight });
    drawRight(`${i + 1}/${pages.length}`, MR, 25, { font, size: 8, color: BRAND.textLight });
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
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
