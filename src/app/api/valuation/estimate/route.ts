import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api/response";
import { parseBody } from "@/lib/api/validate";
import { ValuationEstimateBodySchema } from "@/lib/api/schemas/valuation";
import {
  checkRateLimit,
  rateLimitHeaders,
  rateLimitResponse,
  TIER1_RATE_LIMITS,
} from "@/lib/api/rate-limit";
import { resolveAuthContext } from "@/lib/api/auth-context";
import { createAuditTap } from "@/lib/api/audit-log";

export const dynamic = "force-dynamic";

/**
 * POST /api/valuation/estimate
 * Proxy to RealVisor → Valuo API for property valuation.
 *
 * Full contract: see OpenAPI at /api/openapi (ValuationEstimateBody / ValuationEstimateResponse).
 */

type ValuoResult = {
  avg_price: number;
  min_price: number;
  max_price: number;
  avg_price_m2: number;
  min_price_m2: number;
  max_price_m2: number;
  std_price_m2?: number;
  range_price: [number, number];
  range_price_m2: [number, number];
  calc_area: number;
  currency: string;
  as_of: string;
  avg_score?: number;
  avg_distance?: number;
  avg_age?: number;
  avg_duration?: number;
  distance?: number;
  keep_ids_count?: number;
};

export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  let tap: ReturnType<typeof createAuditTap> = (r) => r;
  try {
    const authCtx = await resolveAuthContext(req, TIER1_RATE_LIMITS["valuation-estimate"]);
    tap = createAuditTap({ endpoint: "/api/valuation/estimate", method: "POST", authCtx, startedAt });

    const rl = await checkRateLimit(authCtx.rateLimitClientKey, authCtx.rateLimitConfig);
    if (!rl.ok) return tap(rateLimitResponse(rl));

    const parsed = await parseBody(req, ValuationEstimateBodySchema);
    if (!parsed.ok) return tap(parsed.response);
    // Cast to loose shape so the existing destructuring pattern keeps working
    // without narrowing the rest of the ~200-line handler.
    const body = parsed.data as Record<string, unknown> & {
      propertyType: "flat" | "house" | "land";
      lat: number;
      lng: number;
      email: string;
    };
    const {
      propertyType, lat, lng, floorArea, lotArea, rating, kind,
      email, name, phone,
      // Optional fields
      localType, ownership, houseType, landType, construction,
      floor, totalFloors, elevator, energyPerformance,
      equipment, easyAccess,
      loggiaArea, balconyArea, terraceArea, cellarArea, gardenArea,
      rooms, bathrooms, garages, parkingSpaces,
    } = body as Record<string, unknown> as {
      propertyType: "flat" | "house" | "land";
      lat: number;
      lng: number;
      floorArea?: number;
      lotArea?: number;
      rating?: number;
      kind?: "sale" | "rent";
      email: string;
      name?: string;
      phone?: string;
      localType?: string;
      ownership?: string;
      houseType?: string;
      landType?: string;
      construction?: string;
      floor?: number;
      totalFloors?: number;
      elevator?: boolean;
      energyPerformance?: string;
      equipment?: boolean;
      easyAccess?: boolean;
      loggiaArea?: number;
      balconyArea?: number;
      terraceArea?: number;
      cellarArea?: number;
      gardenArea?: number;
      rooms?: number;
      bathrooms?: number;
      garages?: number;
      parkingSpaces?: number;
    };

    // ── Build Valuo API request ──
    const valuoRequest: Record<string, unknown> = {
      place: `${lat}, ${lng}`,
      kind: kind || "sale",
      property_type: propertyType,
    };

    if (propertyType === "flat") {
      valuoRequest.floor_area = floorArea;
      if (rating) valuoRequest.rating = rating;
      if (localType) valuoRequest.local_type = localType;
      valuoRequest.ownership = ownership || "private"; // Valuo requires ownership for flats
    } else if (propertyType === "house") {
      valuoRequest.floor_area = floorArea;
      if (rating) valuoRequest.rating = rating;
      if (lotArea) valuoRequest.lot_area = lotArea;
      if (houseType) valuoRequest.house_type = houseType;
    } else if (propertyType === "land") {
      valuoRequest.lot_area = lotArea || floorArea;
      if (landType) valuoRequest.land_type = landType;
    }

    // Optional fields
    if (construction) valuoRequest.construction = construction;
    if (floor !== undefined) valuoRequest.floor = floor;
    if (totalFloors) valuoRequest.total_floors = totalFloors;
    if (elevator !== undefined) valuoRequest.elevator = elevator;
    if (energyPerformance) valuoRequest.energy_performance = energyPerformance;
    if (equipment !== undefined) valuoRequest.equipment = equipment;
    if (easyAccess !== undefined) valuoRequest.easy_access = easyAccess;
    if (loggiaArea) valuoRequest.loggia_area = loggiaArea;
    if (balconyArea) valuoRequest.balcony_area = balconyArea;
    if (terraceArea) valuoRequest.terrace_area = terraceArea;
    if (cellarArea) valuoRequest.cellar_area = cellarArea;
    if (gardenArea) valuoRequest.garden_area = gardenArea;
    if (rooms) valuoRequest.rooms = rooms;
    if (bathrooms) valuoRequest.bathrooms = bathrooms;
    if (garages) valuoRequest.garages = garages;
    if (parkingSpaces) valuoRequest.parking_spaces = parkingSpaces;

    // ── Call RealVisor API (proxies to Valuo) ──
    const REALVISOR_API_URL = process.env.REALVISOR_API_URL || "https://api-production-88cf.up.railway.app";
    const REALVISOR_API_KEY = process.env.REALVISOR_API_KEY || "";

    let valuoResult: ValuoResult | null = null;
    let realvisorFullResponse: Record<string, unknown> | null = null;

    // Try RealVisor API (POST /api/v1/public/api-leads/valuo)
    if (!REALVISOR_API_KEY) {
      console.error("[valuation/estimate] REALVISOR_API_KEY not configured");
      return tap(apiError("SERVICE_UNAVAILABLE", "Služba ocenění není nakonfigurována.", 503));
    }
    {
      try {
        const valuoBody = {
          firstName: (name || "Návštěvník").trim(),
          lastName: (String(body.lastName || "Nemovizor")).trim(),
          email,
          phone: phone || "",
          kind: kind || "sale",
          propertyType,
          address: String(body.address || ""),
          lat, lng,
          floorArea: floorArea || undefined,
          lotArea: lotArea || undefined,
          rating,
          localType, ownership, houseType, landType, construction,
          floor, totalFloors, elevator, energyPerformance,
          equipment, easyAccess,
          loggiaArea, balconyArea, terraceArea, cellarArea, gardenArea,
          rooms, bathrooms, garages, parkingSpaces,
          street: body.street, city: body.city, district: body.district,
          region: body.region, postalCode: body.postalCode,
          data: { source: "nemovizor-oceneni" },
        };

        const res = await fetch(`${REALVISOR_API_URL}/api/v1/public/api-leads/valuo`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": REALVISOR_API_KEY,
          },
          body: JSON.stringify(valuoBody),
          signal: AbortSignal.timeout(25000),
        });

        if (res.ok) {
          const data = await res.json();
          realvisorFullResponse = data; // Store complete response
          const v = data.valuation;
          if (v && (v.avgPrice || v.avg_price)) {
            valuoResult = {
              avg_price: v.avgPrice ?? v.avg_price ?? 0,
              min_price: v.minPrice ?? v.min_price ?? 0,
              max_price: v.maxPrice ?? v.max_price ?? 0,
              avg_price_m2: v.avgPriceM2 ?? v.avg_price_m2 ?? 0,
              min_price_m2: v.minPriceM2 ?? v.min_price_m2 ?? 0,
              max_price_m2: v.maxPriceM2 ?? v.max_price_m2 ?? 0,
              std_price_m2: v.stdPriceM2 ?? v.std_price_m2 ?? 0,
              range_price: v.rangePrice ?? v.range_price ?? [0, 0],
              range_price_m2: v.rangePriceM2 ?? v.range_price_m2 ?? [0, 0],
              calc_area: v.calcArea ?? v.calc_area ?? 0,
              currency: v.currency ?? "CZK",
              as_of: v.asOf ?? v.as_of ?? new Date().toISOString().slice(0, 10),
              avg_score: v.avgScore ?? v.avg_score ?? 0,
              avg_distance: v.avgDistance ?? v.avg_distance ?? 0,
              avg_age: v.avgAge ?? v.avg_age ?? 0,
              avg_duration: v.avgDuration ?? v.avg_duration ?? 0,
              distance: v.distance ?? 0,
              keep_ids_count: (v.keepIds ?? data.valuoRawResponse?.keep_ids ?? []).length,
            };
          } else if (v?.result) {
            valuoResult = v.result;
          }
        } else {
          const errText = await res.text().catch(() => "");
          console.error("[valuation/estimate] RealVisor API", res.status, errText.slice(0, 200));
        }
      } catch (e) {
        console.error("[valuation/estimate] RealVisor API error:", e);
      }
    }

    // No fallback — RealVisor is the only source
    if (!valuoResult) {
      return tap(apiError("INTERNAL_ERROR", "Ocenění se nepodařilo. Zkuste to prosím znovu.", 502));
    }

    // ── Save to DB (non-blocking — don't fail if tables missing) ──
    let valuationId: string | null = null;
    try {
      const { getSupabase } = await import("@/lib/supabase");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = getSupabase() as any;
      if (client) {
        const insertResult = await client.from("valuation_reports").insert({
          email,
          name: name || null,
          phone: phone || null,
          user_id: body.userId || null,
          property_params: body,
          valuo_request: valuoRequest,
          valuo_response: valuoResult,
          estimated_price: valuoResult?.avg_price || 0,
          price_range_min: valuoResult?.min_price || valuoResult?.range_price?.[0] || 0,
          price_range_max: valuoResult?.max_price || valuoResult?.range_price?.[1] || 0,
          price_per_m2: valuoResult?.avg_price_m2 || 0,
          used_fallback: false,
          cadastre_data: realvisorFullResponse?.cadastre || null,
          realvisor_valuation_id: realvisorFullResponse?.valuationId || null,
          realvisor_lead_id: realvisorFullResponse?.leadId || null,
          realvisor_property_id: realvisorFullResponse?.propertyId || null,
        }).select("id").single();
        if (insertResult.error) {
          console.error("[valuation] DB insert error:", insertResult.error.message);
        } else if (insertResult.data?.id) {
          valuationId = insertResult.data.id;
        }

        await client.from("leads").insert({
          name: name || "",
          email,
          phone: phone || "",
          property_type: propertyType,
          intent: "odhad",
          address: body.address || `${lat}, ${lng}`,
          note: `Ocenění: ${valuoResult?.avg_price?.toLocaleString("cs")} Kč`,
          source: "nemovizor-oceneni",
        }).catch(() => {});
      }
    } catch (dbErr) {
      console.error("[valuation] DB save error:", dbErr);
    }

    // ── Pre-generate PDF in background (don't block response) ──
    if (valuationId) {
      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://nemovizor.vercel.app";
      fetch(`${baseUrl}/api/valuation/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ valuationId, skipPayment: true }),
      }).catch((e) => console.error("[valuation] PDF pre-generation error:", e));
    }

    return tap(NextResponse.json(
      {
        success: true,
        valuationId,
        result: {
          avg_price: valuoResult?.avg_price || 0,
          min_price: valuoResult?.min_price || 0,
          max_price: valuoResult?.max_price || 0,
          avg_price_m2: valuoResult?.avg_price_m2 || 0,
          range_price: valuoResult?.range_price || [0, 0],
          currency: valuoResult?.currency || "CZK",
          calc_area: valuoResult?.calc_area || floorArea || 0,
          as_of: valuoResult?.as_of || new Date().toISOString().slice(0, 10),
        },
      },
      { headers: rateLimitHeaders(rl) },
    ));
  } catch (e) {
    console.error("[valuation/estimate] Error:", e);
    return tap(apiError("INTERNAL_ERROR", "Chyba při ocenění", 500));
  }
}

