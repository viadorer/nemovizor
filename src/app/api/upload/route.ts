// ============================================================
// POST /api/upload — Nahrání souboru do Cloudflare R2
// Podporuje: obrázky (max 10 MB) a videa (max 500 MB)
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { uploadFile, validateFile, type MediaType } from "@/lib/r2";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const mediaType = (formData.get("mediaType") as MediaType) || "image";
    const propertyId = formData.get("propertyId") as string | null;

    if (!file) {
      return NextResponse.json({ error: "Nebyl přiložen žádný soubor." }, { status: 400 });
    }

    // Validace
    const validation = validateFile(file.type, file.size, mediaType);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Nahrání do R2
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await uploadFile({
      buffer,
      filename: file.name,
      contentType: file.type,
      mediaType,
      propertyId: propertyId ?? undefined,
    });

    return NextResponse.json({
      success: true,
      key: result.key,
      url: result.url,
      size: result.size,
    });
  } catch (error) {
    console.error("Upload error:", error);
    const message = error instanceof Error ? error.message : "Neočekávaná chyba při nahrávání.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
