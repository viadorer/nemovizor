import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const REPORT_PRICE_CREDITS = 50;

/**
 * POST /api/valuation/report
 * Generates a detailed PDF valuation report.
 * 1. Validates payment (wallet credits or free for testing)
 * 2. Calls Gemini for AI commentary
 * 3. Generates PDF with jsPDF
 * 4. Uploads to R2
 * 5. Updates valuation_reports record
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

      // Deduct credits
      const newBalance = wallet.credits - REPORT_PRICE_CREDITS;
      await client.from("wallets").update({ credits: newBalance }).eq("id", wallet.id);
      await client.from("wallet_transactions").insert({
        wallet_id: wallet.id,
        type: "debit",
        amount: REPORT_PRICE_CREDITS,
        credits: REPORT_PRICE_CREDITS,
        balance_before: wallet.credits,
        balance_after: newBalance,
        category: "service_purchase",
        description: `PDF report ocenění — ${report.property_params?.address || "nemovitost"}`,
        reference_type: "valuation_report",
        reference_id: valuationId,
        created_by: userId,
      });
    }

    // ── 3. Generate AI commentary with Gemini ──
    const valuation = report.valuo_response || {};
    const params = report.property_params || {};
    const geminiText = await generateGeminiCommentary(params, valuation);

    // ── 4. Build report_data snapshot ──
    const reportData = {
      version: 1,
      generated_at: new Date().toISOString(),
      property: {
        address: params.address || "",
        city: params.city || "",
        lat: params.lat || 0,
        lng: params.lng || 0,
        type: params.propertyType || "flat",
        area: params.floorArea || 0,
        lotArea: params.lotArea || 0,
        disposition: params.localType || params.disposition || "",
        condition: params.rating || params.condition || "",
        floor: params.floor || null,
        totalFloors: params.totalFloors || null,
        ownership: params.ownership || "private",
        yearBuilt: params.yearBuilt || null,
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
      branding: {
        name: "Nemovizor",
        color: "#FFB800",
        url: "https://nemovizor.cz",
      },
    };

    // ── 5. Generate PDF ──
    const pdfBuffer = await generatePDF(reportData);

    // ── 6. Upload to R2 ──
    const pdfUrl = await uploadPdfToR2(pdfBuffer, valuationId);

    // ── 7. Update DB ──
    await client.from("valuation_reports").update({
      gemini_text: geminiText,
      report_data: reportData,
      report_version: 1,
      pdf_url: pdfUrl,
      pdf_generated_at: new Date().toISOString(),
      paid: !skipPayment,
      amount_paid: skipPayment ? 0 : REPORT_PRICE_CREDITS,
      payment_method: skipPayment ? null : "wallet",
    }).eq("id", valuationId);

    return NextResponse.json({
      success: true,
      pdf_url: pdfUrl,
      report_data: reportData,
    });
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

  const prompt = `Jsi profesionální odhadce nemovitostí v České republice. Napiš krátký, věcný a profesionální komentář k ocenění nemovitosti v češtině (max 200 slov). Nepoužívej emotikony.

Údaje o nemovitosti:
- Typ: ${params.propertyType === "flat" ? "byt" : params.propertyType === "house" ? "dům" : "pozemek"}
- Adresa: ${params.address || "neuvedena"}
- Město: ${params.city || "neuvedeno"}
- Dispozice: ${params.localType || params.disposition || "neuvedena"}
- Plocha: ${params.floorArea || "neuvedena"} m²
- Stav: ${params.rating || params.condition || "neuvedeno"}
- Patro: ${params.floor || "neuvedeno"}

Výsledek ocenění:
- Odhadovaná cena: ${avgPrice.toLocaleString("cs")} Kč
- Rozsah: ${minPrice.toLocaleString("cs")} – ${maxPrice.toLocaleString("cs")} Kč
- Cena za m²: ${avgPriceM2.toLocaleString("cs")} Kč/m²

Struktura komentáře:
1. Stručné zhodnocení ceny ve vztahu k lokalitě
2. Faktory ovlivňující cenu (pozitivní i negativní)
3. Doporučení pro prodávajícího/kupujícího`;

  try {
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
    });
    return response.text?.trim() || "AI komentář se nepodařilo vygenerovat.";
  } catch (e) {
    console.error("[valuation/report] Gemini error:", e);
    return "AI komentář není momentálně k dispozici.";
  }
}

// ═══════════════════════════════════════════════════════════════
// PDF Generation with jsPDF
// ═══════════════════════════════════════════════════════════════
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function generatePDF(data: any): Promise<Buffer> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const W = 210;
  const MARGIN = 20;
  const CW = W - 2 * MARGIN; // content width
  let y = 20;

  const fmtPrice = (n: number) => n ? `${Math.round(n).toLocaleString("cs")} Kč` : "—";

  // ── Header bar ──
  doc.setFillColor(255, 184, 0); // #FFB800
  doc.rect(0, 0, W, 35, "F");
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("NEMOVIZOR", MARGIN, 18);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Oceneni nemovitosti", MARGIN, 26);
  doc.setFontSize(9);
  doc.text(data.generated_at?.slice(0, 10) || "", W - MARGIN, 26, { align: "right" });

  y = 45;

  // ── Property info ──
  doc.setTextColor(60, 60, 60);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Nemovitost", MARGIN, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  const prop = data.property || {};
  const lines = [
    ["Adresa", prop.address || "—"],
    ["Typ", prop.type === "flat" ? "Byt" : prop.type === "house" ? "Dum" : prop.type === "land" ? "Pozemek" : prop.type || "—"],
    ["Dispozice", prop.disposition || "—"],
    ["Plocha", prop.area ? `${prop.area} m2` : "—"],
    ["Stav", prop.condition || "—"],
    ["Patro", prop.floor ? `${prop.floor}/${prop.totalFloors || "?"}` : "—"],
    ["Vlastnictvi", prop.ownership || "—"],
  ];

  for (const [label, value] of lines) {
    doc.setTextColor(120, 120, 120);
    doc.text(label, MARGIN, y);
    doc.setTextColor(30, 30, 30);
    doc.text(String(value), MARGIN + 45, y);
    y += 6;
  }

  y += 8;

  // ── Valuation result ──
  const val = data.valuation || {};
  doc.setFillColor(250, 250, 245);
  doc.roundedRect(MARGIN, y - 4, CW, 52, 3, 3, "F");

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(60, 60, 60);
  doc.text("Vysledek oceneni", MARGIN + 5, y + 4);

  doc.setFontSize(24);
  doc.setTextColor(0, 0, 0);
  doc.text(fmtPrice(val.avg_price), MARGIN + 5, y + 20);

  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text("odhadovana trzni cena", MARGIN + 5, y + 28);

  // Right side — range
  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);
  doc.text("Rozsah ceny", MARGIN + CW / 2 + 5, y + 4);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.text(`${fmtPrice(val.min_price)} - ${fmtPrice(val.max_price)}`, MARGIN + CW / 2 + 5, y + 14);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);
  doc.text("Cena za m2", MARGIN + CW / 2 + 5, y + 24);
  doc.setFont("helvetica", "bold");
  doc.text(`${fmtPrice(val.avg_price_m2)}/m2`, MARGIN + CW / 2 + 5, y + 32);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(140, 140, 140);
  doc.text(`Datum oceneni: ${val.as_of || "—"} | Kvalita dat: ${Math.round((val.avg_score || 0) * 100)}%`, MARGIN + 5, y + 44);

  y += 60;

  // ── Cadastre ──
  if (data.cadastre) {
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(60, 60, 60);
    doc.text("Katastralni udaje", MARGIN, y);
    y += 7;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const cad = data.cadastre;
    if (cad.cadastralArea) { doc.text(`Katastralni uzemi: ${cad.cadastralArea}`, MARGIN, y); y += 6; }
    if (cad.parcelNumber) { doc.text(`Parcela: ${cad.parcelNumber}`, MARGIN, y); y += 6; }
    y += 5;
  }

  // ── AI Commentary ──
  if (data.ai_commentary) {
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(60, 60, 60);
    doc.text("Odborny komentar", MARGIN, y);
    y += 7;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(40, 40, 40);

    const textLines = doc.splitTextToSize(data.ai_commentary, CW);
    for (const line of textLines) {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      doc.text(line, MARGIN, y);
      y += 4.5;
    }
    y += 5;
  }

  // ── Disclaimer ──
  if (y > 255) { doc.addPage(); y = 20; }
  doc.setFontSize(7);
  doc.setTextColor(160, 160, 160);
  const disclaimer = "Tento odhad je orientacni a nevytvari zavazny znalecky posudek. Odhad vychazi z porovnani s realizovanymi obchody v okoli a je poskytovan bez zaruky. Pro zavazne ucely (hypoteka, soud) doporucujeme znalecky posudek.";
  const disclaimerLines = doc.splitTextToSize(disclaimer, CW);
  for (const line of disclaimerLines) {
    doc.text(line, MARGIN, y);
    y += 3.5;
  }

  // ── Footer ──
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(180, 180, 180);
    doc.text("nemovizor.cz", MARGIN, 290);
    doc.text(`${i}/${pageCount}`, W - MARGIN, 290, { align: "right" });
  }

  return Buffer.from(doc.output("arraybuffer"));
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
    console.warn("[valuation/report] R2 not configured, returning data URL");
    return "";
  }

  const r2 = new S3Client({
    region: "auto",
    endpoint: R2_ENDPOINT,
    credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
  });

  const key = `reports/valuation-${valuationId}-${Date.now()}.pdf`;
  await r2.send(new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: "application/pdf",
    CacheControl: "public, max-age=31536000, immutable",
  }));

  return R2_PUBLIC_URL ? `${R2_PUBLIC_URL}/${key}` : key;
}
