import { PDFDocument, rgb, PDFPage, PDFFont } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import fs from "fs/promises";
import path from "path";

const B = {
  accent: rgb(1, 0.722, 0),
  text: rgb(0.12, 0.12, 0.12),
  muted: rgb(0.45, 0.47, 0.5),
  light: rgb(0.62, 0.64, 0.67),
  border: rgb(0.88, 0.89, 0.9),
  bg: rgb(0.97, 0.97, 0.96),
  white: rgb(1, 1, 1),
  black: rgb(0, 0, 0),
  green: rgb(0.13, 0.73, 0.38),
  red: rgb(0.93, 0.26, 0.14),
  yellow: rgb(1, 0.86, 0.4),
};

const W = 595; const H = 842;
const ML = 45; const MR = 550; const CW = MR - ML;

const fmtP = (n: number) => n ? `${Math.round(n).toLocaleString("cs")} Kč` : "—";
const fmtPm = (n: number) => n ? `${Math.round(n).toLocaleString("cs")} Kč/m²` : "—";

// ── Helpers ──
function drawR(pg: PDFPage, t: string, x: number, y: number, f: PDFFont, s: number, c: ReturnType<typeof rgb>) {
  pg.drawText(t, { x: x - f.widthOfTextAtSize(t, s), y, size: s, font: f, color: c });
}
function wrap(t: string, mw: number, f: PDFFont, s: number): string[] {
  const ws = t.split(" "); const ls: string[] = []; let l = "";
  for (const w of ws) { const x = l ? `${l} ${w}` : w; if (f.widthOfTextAtSize(x, s) > mw) { if (l) ls.push(l); l = w; } else { l = x; } }
  if (l) ls.push(l); return ls;
}
function row(pg: PDFPage, lb: string, vl: string, y: number, f: PDFFont, fb: PDFFont, lx = ML, vx = ML + 130) {
  pg.drawText(lb, { x: lx, y, size: 9, font: f, color: B.muted });
  pg.drawText(vl, { x: vx, y, size: 9.5, font: fb, color: B.text });
}
function scoreBar(pg: PDFPage, x: number, y: number, w: number, pct: number, lb: string, f: PDFFont) {
  pg.drawRectangle({ x, y, width: w, height: 10, color: B.border });
  const c = pct >= 70 ? B.green : pct >= 40 ? B.yellow : B.red;
  pg.drawRectangle({ x, y, width: Math.max(w * pct / 100, 3), height: 10, color: c });
  pg.drawText(`${lb}: ${pct}%`, { x, y: y - 12, size: 7.5, font: f, color: B.muted });
}
function priceScale(pg: PDFPage, x: number, y: number, w: number, min: number, max: number, avg: number, rMin: number, rMax: number, f: PDFFont, fb: PDFFont) {
  if (!min || !max) return y;
  const range = max - min || 1;
  pg.drawRectangle({ x, y, width: w, height: 14, color: rgb(0.92, 0.93, 0.94) });
  const s = ((rMin - min) / range) * w; const e = ((rMax - min) / range) * w;
  pg.drawRectangle({ x: x + s, y, width: Math.max(e - s, 4), height: 14, color: B.yellow });
  const ax = x + ((avg - min) / range) * w;
  pg.drawRectangle({ x: ax - 1.5, y: y - 2, width: 3, height: 18, color: B.red });
  pg.drawText(fmtP(min), { x, y: y - 14, size: 7, font: f, color: B.light });
  pg.drawText(fmtP(avg), { x: ax - 25, y: y + 18, size: 8, font: fb, color: B.red });
  drawR(pg, fmtP(max), x + w, y - 14, f, 7, B.light);
  // legend
  pg.drawRectangle({ x, y: y - 28, width: 10, height: 5, color: rgb(0.92, 0.93, 0.94) });
  pg.drawText("Min–Max", { x: x + 14, y: y - 27, size: 6.5, font: f, color: B.light });
  pg.drawRectangle({ x: x + 65, y: y - 28, width: 10, height: 5, color: B.yellow });
  pg.drawText("25.–75. percentil", { x: x + 79, y: y - 27, size: 6.5, font: f, color: B.light });
  pg.drawRectangle({ x: x + 170, y: y - 28, width: 3, height: 5, color: B.red });
  pg.drawText("Průměr", { x: x + 177, y: y - 27, size: 6.5, font: f, color: B.light });
  return y - 38;
}

const TL: Record<string, string> = { flat: "Byt", house: "Dům", land: "Pozemek" };
const CL: Record<string, string> = { excellent: "Luxusní/novostavba", very_good: "Po rekonstrukci", good: "Průměrný", nothing_much: "Před rekonstrukcí", bad: "Neobyvatelný", new: "Novostavba" };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function generateValuationPDF(data: any): Promise<Buffer> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const f = await doc.embedFont(await fs.readFile(path.join(process.cwd(), "public/fonts/Roboto-Regular.ttf")));
  const fb = await doc.embedFont(await fs.readFile(path.join(process.cwd(), "public/fonts/Roboto-Bold.ttf")));
  let logo = null;
  try { logo = await doc.embedPng(await fs.readFile(path.join(process.cwd(), "public/branding/nemovizor_logo.png"))); } catch { /**/ }

  const prop = data.property || {};
  const val = data.valuation || {};
  const cad = data.cadastre || {};
  const apiKey = process.env.NEXT_PUBLIC_MAPY_API_KEY || "";

  // ── Fetch images (correct aspect ratio + pin marker) ──
  let mapImg = null; let panoImg = null;
  if (prop.lat && prop.lng && apiKey) {
    try {
      const marker = encodeURIComponent(`color:red;size:large;${prop.lng},${prop.lat}`);
      const r1 = await fetch(`https://api.mapy.com/v1/static/map?lon=${prop.lng}&lat=${prop.lat}&zoom=16&width=600&height=300&mapset=basic&markers=${marker}&apikey=${apiKey}`, { signal: AbortSignal.timeout(10000) });
      if (r1.ok) { const b = Buffer.from(await r1.arrayBuffer()); if (b.length > 1000) mapImg = await doc.embedPng(b).catch(() => null); }
    } catch { /**/ }
    try {
      const r2 = await fetch(`https://api.mapy.cz/v1/static/pano?lon=${prop.lng}&lat=${prop.lat}&width=600&height=300&yaw=auto&apikey=${apiKey}`, { signal: AbortSignal.timeout(10000) });
      if (r2.ok) { const b = Buffer.from(await r2.arrayBuffer()); if (b.length > 1000) panoImg = await doc.embedJpg(b).catch(() => null); }
    } catch { /**/ }
  }

  // ═══════════════════════════════════════════════════
  // PAGE 1: Property + Images
  // ═══════════════════════════════════════════════════
  const p1 = doc.addPage([W, H]);
  let y = H - 40;

  // Header
  p1.drawRectangle({ x: 0, y: H - 50, width: W, height: 50, color: B.accent });
  if (logo) { const lh = 24; p1.drawImage(logo, { x: ML, y: H - 50 + (50 - lh) / 2, width: lh * (logo.width / logo.height), height: lh }); }
  else { p1.drawText("NEMOVIZOR", { x: ML, y: H - 36, size: 20, font: fb, color: B.black }); }
  p1.drawText("Orientační ocenění nemovitosti", { x: ML, y: H - 46, size: 9, font: f, color: rgb(0.3, 0.24, 0) });
  drawR(p1, (data.generated_at || "").slice(0, 10), MR, H - 36, f, 9, rgb(0.3, 0.24, 0));

  y = H - 80;

  // Property title
  p1.drawText("Nemovitost", { x: ML, y, size: 14, font: fb, color: B.text }); y -= 6;
  p1.drawRectangle({ x: ML, y, width: 50, height: 2, color: B.accent }); y -= 20;

  // Property rows
  const rows = ([
    ["Adresa", prop.address], ["Město", prop.city],
    ["Typ nemovitosti", TL[prop.type] || prop.type],
    ["Dispozice", prop.disposition],
    ["Užitná plocha", prop.area ? `${prop.area} m²` : null],
    ["Plocha pozemku", prop.lotArea ? `${prop.lotArea} m²` : null],
    ["Stav", CL[prop.condition] || prop.condition],
    ["Vlastnictví", prop.ownership === "private" ? "Osobní" : prop.ownership === "cooperative" ? "Družstevní" : prop.ownership],
    ["Patro / Podlaží", prop.floor ? `${prop.floor}. patro z ${prop.totalFloors || "?"}` : null],
    ["Energetický štítek", prop.energyRating],
    ["GPS", prop.lat ? `${Number(prop.lat).toFixed(5)}, ${Number(prop.lng).toFixed(5)}` : null],
  ] as [string, string | null][]).filter(([, v]) => v);

  for (const [lb, vl] of rows) { row(p1, lb, vl!, y, f, f); y -= 16; }
  y -= 20;

  // Map — full width, correct 2:1 aspect ratio
  if (mapImg) {
    p1.drawText("Mapa lokality", { x: ML, y: y + 3, size: 8, font: f, color: B.muted }); y -= 2;
    const mh = Math.round(CW / 2); // 2:1 ratio matching source 600x300
    p1.drawRectangle({ x: ML - 1, y: y - mh - 1, width: CW + 2, height: mh + 2, color: B.border });
    p1.drawImage(mapImg, { x: ML, y: y - mh, width: CW, height: mh });
    y -= mh + 18;
  }

  // Panorama — full width, correct 2:1 aspect ratio
  if (panoImg) {
    p1.drawText("Pohled z ulice", { x: ML, y: y + 3, size: 8, font: f, color: B.muted }); y -= 2;
    const ph = Math.round(CW / 2); // 2:1 ratio matching source 600x300
    p1.drawRectangle({ x: ML - 1, y: y - ph - 1, width: CW + 2, height: ph + 2, color: B.border });
    p1.drawImage(panoImg, { x: ML, y: y - ph, width: CW, height: ph });
    y -= ph + 18;
  }

  // ═══════════════════════════════════════════════════
  // PAGE 2: Valuation + Metrics + Cadastre
  // ═══════════════════════════════════════════════════
  const p2 = doc.addPage([W, H]);
  p2.drawRectangle({ x: 0, y: H - 6, width: W, height: 6, color: B.accent });
  y = H - 50;

  // Valuation box
  const bxH = 130;
  p2.drawRectangle({ x: ML, y: y - bxH + 10, width: CW, height: bxH, color: B.bg });
  p2.drawRectangle({ x: ML, y: y - bxH + 10, width: 4, height: bxH, color: B.accent });

  p2.drawText("Výsledek ocenění", { x: ML + 16, y, size: 11, font: fb, color: B.muted });
  p2.drawText(fmtP(val.avg_price), { x: ML + 16, y: y - 35, size: 30, font: fb, color: B.text });
  p2.drawText("odhadovaná tržní cena", { x: ML + 16, y: y - 52, size: 9, font: f, color: B.muted });

  const sc = Math.round((val.avg_score || 0) * 100);
  scoreBar(p2, ML + 16, y - 75, 200, sc, "Kvalita odhadu", f);

  // Right column
  const rx = ML + CW / 2 + 15;
  p2.drawText("Rozsah ceny", { x: rx, y: y - 4, size: 8.5, font: f, color: B.muted });
  p2.drawText(`${fmtP(val.min_price)} – ${fmtP(val.max_price)}`, { x: rx, y: y - 20, size: 12, font: fb, color: B.text });

  p2.drawText("Cenové pásmo (25.–75. percentil)", { x: rx, y: y - 40, size: 8, font: f, color: B.muted });
  const rp = val.range_price || [0, 0];
  p2.drawText(`${fmtP(rp[0])} – ${fmtP(rp[1])}`, { x: rx, y: y - 54, size: 10, font: f, color: B.text });

  p2.drawText("Cena za m²", { x: rx, y: y - 74, size: 8.5, font: f, color: B.muted });
  p2.drawText(fmtPm(val.avg_price_m2), { x: rx, y: y - 90, size: 13, font: fb, color: B.text });
  const rpm = val.range_price_m2 || [0, 0];
  p2.drawText(`Rozsah: ${fmtPm(rpm[0])} – ${fmtPm(rpm[1])}`, { x: rx, y: y - 106, size: 8, font: f, color: B.muted });

  y -= bxH + 30;

  // Detailed metrics
  p2.drawText("Detailní metriky", { x: ML, y, size: 12, font: fb, color: B.text }); y -= 6;
  p2.drawRectangle({ x: ML, y, width: 50, height: 2, color: B.accent }); y -= 20;

  const metrics = ([
    ["Min. cena za m²", fmtPm(val.min_price_m2)],
    ["Max. cena za m²", fmtPm(val.max_price_m2)],
    ["Směrodatná odchylka", val.std_price_m2 ? `${Math.round(val.std_price_m2).toLocaleString("cs")} Kč/m²` : null],
    ["Započítaná plocha", val.calc_area ? `${val.calc_area} m²` : null],
    ["Porovnáno nemovitostí", val.keep_ids_count ? `${val.keep_ids_count} ks` : null],
    ["Průměrná vzdálenost", val.avg_distance ? `${Math.round(val.avg_distance)} m` : null],
    ["Radius porovnání", val.distance ? `${val.distance} m` : null],
    ["Prům. stáří dat", val.avg_age ? `${Math.round(val.avg_age)} dní` : null],
    ["Prům. doba inzerce", val.avg_duration ? `${Math.round(val.avg_duration)} dní` : null],
    ["Datum výpočtu", val.as_of ? String(val.as_of).slice(0, 10) : null],
  ] as [string, string | null][]).filter(([, v]) => v);

  const half = Math.ceil(metrics.length / 2);
  for (let i = 0; i < half; i++) {
    const [l1, v1] = metrics[i];
    row(p2, l1, v1!, y, f, f, ML, ML + 120);
    if (metrics[i + half]) { const [l2, v2] = metrics[i + half]; row(p2, l2, v2!, y, f, f, ML + CW / 2, ML + CW / 2 + 120); }
    y -= 16;
  }
  y -= 25;

  // Cadastre
  const hasCad = cad.cadastralArea || cad.parcelNumber || cad.building || cad.parcel;
  if (hasCad) {
    p2.drawText("Katastrální údaje (RÚIAN)", { x: ML, y, size: 12, font: fb, color: B.text }); y -= 6;
    p2.drawRectangle({ x: ML, y, width: 50, height: 2, color: B.accent }); y -= 20;

    const cadR = ([
      ["Katastrální území", cad.cadastralArea || cad.parcel?.cadastralName],
      ["Parcela", cad.parcelNumber || cad.parcel?.number],
      ["Kód k. ú.", cad.parcel?.cadastralCode ? String(cad.parcel.cadastralCode) : null],
      ["Počet podlaží", cad.building?.floors ? String(cad.building.floors) : null],
      ["Počet bytů", cad.building?.units ? String(cad.building.units) : null],
      ["Konstrukce", cad.building?.construction],
      ["Datum dokončení", cad.building?.completionDate ? String(cad.building.completionDate).slice(0, 10) : null],
    ] as [string, string | null][]).filter(([, v]) => v);

    for (const [lb, vl] of cadR) { row(p2, lb, vl!, y, f, f); y -= 16; }

    if (cad.building?.completionDate) {
      const yr = new Date(cad.building.completionDate).getFullYear();
      const age = new Date().getFullYear() - yr;
      const rem = Math.max(100 - age, 0);
      y -= 8;
      p2.drawText(`Stáří budovy: ${age} let (rok ${yr})`, { x: ML, y, size: 9, font: fb, color: B.text }); y -= 14;
      scoreBar(p2, ML, y, 200, Math.round(rem), `Zbývající životnost: ${rem} let`, f);
      y -= 25;
    }
  }

  // ═══════════════════════════════════════════════════
  // PAGE 3: Price scales + AI + CTA
  // ═══════════════════════════════════════════════════
  const p3 = doc.addPage([W, H]);
  p3.drawRectangle({ x: 0, y: H - 6, width: W, height: 6, color: B.accent });
  y = H - 50;

  // Price scale
  p3.drawText("Cenová škála", { x: ML, y, size: 13, font: fb, color: B.text }); y -= 6;
  p3.drawRectangle({ x: ML, y, width: 40, height: 2, color: B.accent }); y -= 22;
  y = priceScale(p3, ML, y, CW, val.min_price, val.max_price, val.avg_price, (val.range_price || [0, 0])[0], (val.range_price || [0, 0])[1], f, fb);
  y -= 25;

  // Price per m2 scale
  if (val.min_price_m2 && val.max_price_m2) {
    p3.drawText("Cena za m² — srovnání", { x: ML, y, size: 11, font: fb, color: B.text }); y -= 20;
    const m2R = val.max_price_m2 - val.min_price_m2 || 1;
    p3.drawRectangle({ x: ML, y, width: CW, height: 12, color: rgb(0.92, 0.93, 0.94) });
    const rm = val.range_price_m2 || [0, 0];
    if (rm[0] && rm[1]) {
      const s = ((rm[0] - val.min_price_m2) / m2R) * CW;
      const e = ((rm[1] - val.min_price_m2) / m2R) * CW;
      p3.drawRectangle({ x: ML + s, y, width: Math.max(e - s, 4), height: 12, color: rgb(0.6, 0.85, 0.65) });
    }
    const ax = ML + ((val.avg_price_m2 - val.min_price_m2) / m2R) * CW;
    p3.drawRectangle({ x: ax - 1.5, y: y - 2, width: 3, height: 16, color: rgb(0.13, 0.55, 0.28) });
    p3.drawText(fmtPm(val.min_price_m2), { x: ML, y: y - 16, size: 7, font: f, color: B.light });
    p3.drawText(fmtPm(val.avg_price_m2), { x: ax - 25, y: y + 16, size: 8, font: fb, color: rgb(0.13, 0.55, 0.28) });
    drawR(p3, fmtPm(val.max_price_m2), MR, y - 16, f, 7, B.light);
    y -= 40;
  }

  y -= 15;

  // AI Commentary
  if (data.ai_commentary) {
    p3.drawText("Odborný komentář", { x: ML, y, size: 13, font: fb, color: B.text }); y -= 6;
    p3.drawRectangle({ x: ML, y, width: 50, height: 2, color: B.accent }); y -= 20;

    const clean = String(data.ai_commentary).replace(/\*\*/g, "").replace(/\*/g, "").replace(/#{1,3}\s/g, "").replace(/\n{2,}/g, "\n").trim();
    for (const para of clean.split("\n")) {
      if (!para.trim()) { y -= 8; continue; }
      for (const line of wrap(para.trim(), CW, f, 9.5)) {
        if (y < 200) break;
        p3.drawText(line, { x: ML, y, size: 9.5, font: f, color: B.text });
        y -= 14;
      }
      y -= 5;
    }
    y -= 15;
  }

  // CTA Box
  if (y > 150) {
    const ctaH = 95;
    p3.drawRectangle({ x: ML, y: y - ctaH, width: CW, height: ctaH, color: rgb(0.98, 0.96, 0.9) });
    p3.drawRectangle({ x: ML, y: y - ctaH, width: CW, height: 3, color: B.accent });

    p3.drawText("Chcete přesnější posouzení zdarma?", { x: ML + 16, y: y - 20, size: 13, font: fb, color: B.text });
    p3.drawText("Nabízíme bezplatné osobní posouzení nemovitosti odborníkem — bez závazků.", { x: ML + 16, y: y - 36, size: 9.5, font: f, color: B.text });

    let cy = y - 52;
    for (const l of [
      "Osobní posouzení odborníkem zdarma v lokalitách: Praha, Plzeň, Beroun",
      "Individuální přístup s ohledem na specifika vaší nemovitosti",
      "Doporučení optimální prodejní strategie a stanovení ceny",
    ]) { p3.drawText(`•  ${l}`, { x: ML + 16, y: cy, size: 8.5, font: f, color: B.muted }); cy -= 12; }

    y -= ctaH + 20;
  }

  // Contact
  if (y > 80) {
    p3.drawText("Kontaktujte nás:", { x: ML, y, size: 10, font: fb, color: B.text }); y -= 16;
    p3.drawText("nemovizor.cz  |  info@nemovizor.cz  |  +420 774 052 232", { x: ML, y, size: 9, font: f, color: B.muted });
  }

  // Disclaimer + footer on all pages
  const pages = doc.getPages();
  const lastPg = pages[pages.length - 1];
  lastPg.drawRectangle({ x: ML, y: 55, width: CW, height: 1, color: B.border });
  const disc = "Tento odhad je orientační a nevytváří závazný znalecký posudek. Odhad vychází z porovnání s realizovanými obchody v okolí a je poskytován bez záruky. Pro závazné účely (hypotéka, soud, financování) doporučujeme nechat zpracovat znalecký posudek soudním znalcem. Nemovizor nenese odpovědnost za rozhodnutí učiněná na základě tohoto odhadu.";
  let dy = 48;
  for (const l of wrap(disc, CW, f, 7)) { lastPg.drawText(l, { x: ML, y: dy, size: 7, font: f, color: B.light }); dy -= 9; }

  for (let i = 0; i < pages.length; i++) {
    const pg = pages[i];
    pg.drawText("nemovizor.cz", { x: ML, y: 16, size: 7.5, font: f, color: B.light });
    drawR(pg, `${i + 1}/${pages.length}`, MR, 16, f, 7.5, B.light);
    pg.drawRectangle({ x: 0, y: 12, width: W, height: 2, color: B.accent });
  }

  return Buffer.from(await doc.save());
}
