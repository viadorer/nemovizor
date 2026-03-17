// ============================================================
// Nemovizor – Realman Import API
// POST /api/import/estate/:id  – Create or update property
// DELETE /api/import/estate/:id – Delete (deactivate) property
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { RealmanImportService } from "@/lib/realman-import";
import type { RealmanImportData } from "@/lib/realman-import";

// Realman API key authentication
function authenticateRealman(request: NextRequest): boolean {
  const apiKey = process.env.REALMAN_API_KEY;
  if (!apiKey) {
    console.error("REALMAN_API_KEY is not configured");
    return false;
  }

  // Check Authorization header
  const authHeader = request.headers.get("authorization");
  if (authHeader) {
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (token === apiKey) return true;
  }

  // Check X-API-Key header
  const xApiKey = request.headers.get("x-api-key");
  if (xApiKey === apiKey) return true;

  // Check query parameter
  const urlKey = request.nextUrl.searchParams.get("api_key");
  if (urlKey === apiKey) return true;

  return false;
}

function jsonResponse(data: object, status: number) {
  return NextResponse.json(data, { status });
}

// POST /api/import/estate/[id]
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Auth check
  if (!authenticateRealman(request)) {
    return jsonResponse({ message: "Unauthorized", url: null, external_id: null }, 401);
  }

  const { id } = await params;
  const realmanId = parseInt(id, 10);

  if (isNaN(realmanId)) {
    return jsonResponse({ message: "Invalid estate ID", url: null, external_id: null }, 400);
  }

  // Get admin supabase client
  const supabase = getAdminSupabase();
  if (!supabase) {
    return jsonResponse({ message: "Database not configured", url: null, external_id: null }, 500);
  }

  try {
    const body: RealmanImportData = await request.json();

    // Validate required fields
    if (!body.estate || !body.seller) {
      return jsonResponse(
        { message: "Missing required fields: estate and seller", url: null, external_id: null },
        400
      );
    }

    const service = new RealmanImportService(supabase);
    const result = await service.importEstate(realmanId, body);

    return jsonResponse({
      message: "Estate imported successfully",
      url: `/nemovitosti/${result.slug}`,
      external_id: result.propertyId,
    }, 200);
  } catch (error) {
    console.error("Import error:", error);
    return jsonResponse({
      message: error instanceof Error ? error.message : "Internal server error",
      url: null,
      external_id: null,
    }, 500);
  }
}

// DELETE /api/import/estate/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!authenticateRealman(request)) {
    return jsonResponse({ message: "Unauthorized", url: null, external_id: null }, 401);
  }

  const { id } = await params;
  const realmanId = parseInt(id, 10);

  if (isNaN(realmanId)) {
    return jsonResponse({ message: "Invalid estate ID", url: null, external_id: null }, 400);
  }

  const supabase = getAdminSupabase();
  if (!supabase) {
    return jsonResponse({ message: "Database not configured", url: null, external_id: null }, 500);
  }

  try {
    const service = new RealmanImportService(supabase);
    await service.deleteEstate(realmanId);

    return jsonResponse({
      message: "Estate deleted successfully",
      url: null,
      external_id: null,
    }, 200);
  } catch (error) {
    console.error("Delete error:", error);
    return jsonResponse({
      message: error instanceof Error ? error.message : "Internal server error",
      url: null,
      external_id: null,
    }, 500);
  }
}
