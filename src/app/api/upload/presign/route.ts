// ============================================================
// POST /api/upload/presign — Presigned URL pro přímý upload z browseru
// Browser uploaduje přímo do R2 (bypass serveru = rychlejší pro velké soubory)
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getPresignedUploadUrl, validateFile, getPublicUrl, type MediaType } from "@/lib/r2";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { filename, contentType, size, mediaType = "image", propertyId } = body as {
      filename: string;
      contentType: string;
      size: number;
      mediaType?: MediaType;
      propertyId?: string;
    };

    if (!filename || !contentType || !size) {
      return NextResponse.json(
        { error: "Chybí filename, contentType nebo size." },
        { status: 400 }
      );
    }

    // Validace typu a velikosti
    const validation = validateFile(contentType, size, mediaType);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Generování presigned URL
    const { url, key } = await getPresignedUploadUrl(filename, contentType, mediaType, propertyId);

    return NextResponse.json({
      uploadUrl: url,
      key,
      publicUrl: getPublicUrl(key),
    });
  } catch (error) {
    console.error("Presign error:", error);
    const message = error instanceof Error ? error.message : "Neočekávaná chyba.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
