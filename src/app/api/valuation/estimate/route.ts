import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/valuation/estimate
 * Proxy to RealVisor → Valuo API for property valuation.
 * Falls back to own DB-based estimate if external API unavailable.
 *
 * Body: { propertyType, lat, lng, floorArea, rating, kind, email, name, phone, ...optional }
 * Returns: { avg_price, min_price, max_price, avg_price_m2, range_price, success }
 */

type ValuoResult = {
  avg_price: number;
  min_price: number;
  max_price: number;
  avg_price_m2: number;
  min_price_m2: number;
  max_price_m2: number;
  range_price: [number, number];
  range_price_m2: [number, number];
  calc_area: number;
  currency: string;
  as_of: string;
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      propertyType, lat, lng, floorArea, lotArea, rating, kind,
      email, name, phone,
      // Optional fields
      localType, ownership, houseType, landType, construction,
      floor, totalFloors, elevator, energyPerformance,
      equipment, easyAccess,
      loggiaArea, balconyArea, terraceArea, cellarArea, gardenArea,
      rooms, bathrooms, garages, parkingSpaces,
    } = body;

    // Validate required fields
    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Platný email je povinný" }, { status: 400 });
    }
    if (!propertyType || !lat || !lng) {
      return NextResponse.json({ error: "Typ nemovitosti a adresa jsou povinné" }, { status: 400 });
    }
    if (propertyType !== "land" && !floorArea) {
      return NextResponse.json({ error: "Plocha je povinná" }, { status: 400 });
    }

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

    // Try RealVisor API (POST /api/v1/public/api-leads/valuo)
    if (!REALVISOR_API_KEY) {
      console.error("[valuation/estimate] REALVISOR_API_KEY not configured");
      return NextResponse.json({ error: "Služba ocenění není nakonfigurována." }, { status: 503 });
    }
    {
      try {
        const nameParts = (name || "").trim().split(" ");
        const firstName = nameParts[0] || "Návštěvník";
        const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "Nemovizor";
        const valuoBody = {
          firstName,
          lastName,
          email,
          phone: phone || "",
          kind: kind || "sale",
          propertyType,
          address: body.address || "",
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
          const v = data.valuation;
          if (v && (v.avgPrice || v.avg_price)) {
            // Map camelCase (RealVisor) to snake_case (our internal format)
            valuoResult = {
              avg_price: v.avgPrice ?? v.avg_price ?? 0,
              min_price: v.minPrice ?? v.min_price ?? 0,
              max_price: v.maxPrice ?? v.max_price ?? 0,
              avg_price_m2: v.avgPriceM2 ?? v.avg_price_m2 ?? 0,
              min_price_m2: v.minPriceM2 ?? v.min_price_m2 ?? 0,
              max_price_m2: v.maxPriceM2 ?? v.max_price_m2 ?? 0,
              range_price: v.rangePrice ?? v.range_price ?? [0, 0],
              range_price_m2: v.rangePriceM2 ?? v.range_price_m2 ?? [0, 0],
              calc_area: v.calcArea ?? v.calc_area ?? 0,
              currency: v.currency ?? "CZK",
              as_of: v.asOf ?? v.as_of ?? new Date().toISOString().slice(0, 10),
            };
          } else if (v?.result) {
            valuoResult = v.result; // raw Valuo response nested
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
      return NextResponse.json({ error: "Ocenění se nepodařilo. Zkuste to prosím znovu." }, { status: 502 });
    }

    // ── Save to DB (non-blocking — don't fail if tables missing) ──
    let valuationId: string | null = null;
    try {
      const { getSupabase } = await import("@/lib/supabase");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = getSupabase() as any;
      if (client) {
        const { data: inserted } = await client.from("valuation_reports").insert({
          email,
          name: name || null,
          phone: phone || null,
          property_params: body,
          valuo_request: valuoRequest,
          valuo_response: valuoResult,
          estimated_price: valuoResult?.avg_price || 0,
          price_range_min: valuoResult?.min_price || valuoResult?.range_price?.[0] || 0,
          price_range_max: valuoResult?.max_price || valuoResult?.range_price?.[1] || 0,
          price_per_m2: valuoResult?.avg_price_m2 || 0,
          used_fallback: false,
        }).select("id").single().catch(() => ({ data: null }));
        if (inserted?.id) valuationId = inserted.id;

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

    return NextResponse.json({
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
    });
  } catch (e) {
    console.error("[valuation/estimate] Error:", e);
    return NextResponse.json({ error: "Chyba při ocenění" }, { status: 500 });
  }
}

