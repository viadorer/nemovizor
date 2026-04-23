/**
 * Property import processor.
 * Dedup: external_id + external_source.
 * Handles image download → R2 upload, broker linkage, change detection.
 */
import type { ImportItemResult } from "./processor";
import { generateUniqueSlug } from "./slug-generator";
import { downloadImages, type ImageInput } from "./image-downloader";

export async function processProperty(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  agencyId: string,
  externalSource: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: Record<string, any>,
): Promise<ImportItemResult> {
  const started = Date.now();
  const warnings: string[] = [];

  try {
    const { external_id, broker_external_id, images: imageInputs, ...fields } = payload;

    // Deactivation request
    if (fields.active === false) {
      const { data: existing } = await supabase
        .from("properties")
        .select("id, slug")
        .eq("external_id", external_id)
        .eq("external_source", externalSource)
        .maybeSingle();

      if (!existing) {
        return {
          status: "skipped",
          errors: [],
          warnings: ["Property not found for deactivation"],
          nemovizorId: null,
          nemovizorSlug: null,
          action: null,
          processingTimeMs: Date.now() - started,
        };
      }

      await supabase
        .from("properties")
        .update({ active: false, extra_info: "prodano" })
        .eq("id", existing.id);

      return {
        status: "success",
        errors: [],
        warnings,
        nemovizorId: existing.id,
        nemovizorSlug: existing.slug,
        action: "deactivated",
        processingTimeMs: Date.now() - started,
      };
    }

    // Resolve broker_id
    let brokerId: string | null = null;
    if (broker_external_id) {
      const { data: broker } = await supabase
        .from("brokers")
        .select("id")
        .eq("external_id", broker_external_id)
        .eq("external_source", externalSource)
        .maybeSingle();

      if (broker) {
        brokerId = broker.id;
      } else {
        warnings.push(`Broker external_id "${broker_external_id}" not found`);
      }
    }

    // Check if property exists
    const { data: existing } = await supabase
      .from("properties")
      .select("id, slug, title, price, description, active")
      .eq("external_id", external_id)
      .eq("external_source", externalSource)
      .maybeSingle();

    // Build row from payload
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row: Record<string, any> = {
      external_id,
      external_source: externalSource,
      active: true,
    };

    // Map ALL known property fields (172 columns in DB)
    const directFields = [
      // Core
      "title", "listing_type", "category", "subtype", "rooms_label",
      // Price
      "price", "price_currency", "price_unit", "price_note", "price_negotiation",
      // Location
      "city", "district", "street", "zip", "region", "city_part", "country",
      "latitude", "longitude", "location_label",
      // Areas (all 16)
      "area", "land_area", "built_up_area", "floor_area", "balcony_area",
      "basin_area", "cellar_area", "garden_area", "loggia_area", "terrace_area",
      "nolive_total_area", "offices_area", "production_area", "shop_area",
      "store_area", "workshop_area",
      // Description
      "summary", "description",
      // Building parameters
      "condition", "ownership", "furnishing", "energy_rating", "building_material",
      "flooring",
      // Floor info
      "floor", "total_floors", "underground_floors", "ceiling_height",
      // Amenities (booleans)
      "balcony", "terrace", "garden", "elevator", "cellar", "garage", "pool",
      "loggia", "low_energy", "ftv_panels", "solar_panels", "mortgage",
      // Parking
      "parking", "parking_spaces", "garage_count",
      // Access & type
      "easy_access", "object_type", "object_kind", "object_location", "flat_class",
      // Infrastructure (arrays)
      "heating", "heating_element", "heating_source", "water_heat_source",
      "electricity", "gas", "water", "gully", "road_type",
      "telecommunication", "transport", "internet_connection_type",
      // Internet
      "internet_connection_provider", "internet_connection_speed",
      // Surroundings
      "surroundings_type", "protection",
      // Electrical
      "circuit_breaker", "phase_distribution",
      // Well
      "well_type",
      // Financial
      "annuity", "cost_of_living", "commission", "mortgage_percent",
      "spor_percent", "refundable_deposit",
      // Lease/rental
      "lease_type", "tenant_not_pay_commission", "ready_date",
      // Auction
      "auction_kind", "auction_date", "auction_place",
      "price_auction_principal", "price_expert_report", "price_minimum_bid",
      // Shares
      "share_numerator", "share_denominator",
      // Age/dates
      "year_built", "last_renovation", "acceptance_year",
      "beginning_date", "finish_date", "sale_date", "first_tour_date",
      // Status
      "extra_info", "exclusively_at_rk", "personal_transfer", "num_owners",
      // Media
      "matterport_url", "mapy_panorama_url",
      // Other
      "keywords", "apartment_number",
    ];

    for (const f of directFields) {
      if (fields[f] !== undefined) row[f] = fields[f];
    }

    if (brokerId) row.broker_id = brokerId;

    // Handle images
    const images: ImageInput[] = imageInputs ?? [];
    let propertyId = existing?.id;

    if (existing) {
      // Change detection: skip update if nothing changed
      const unchanged =
        existing.title === fields.title &&
        existing.price === fields.price &&
        existing.description === (fields.description ?? null) &&
        existing.active === true &&
        images.length === 0; // if no images provided, treat as unchanged

      if (unchanged) {
        return {
          status: "success",
          errors: [],
          warnings,
          nemovizorId: existing.id,
          nemovizorSlug: existing.slug,
          action: "unchanged",
          processingTimeMs: Date.now() - started,
        };
      }

      // UPDATE
      const { error } = await supabase
        .from("properties")
        .update(row)
        .eq("id", existing.id);

      if (error) return errResult(error.message, warnings, started);
      propertyId = existing.id;
    } else {
      // INSERT — need slug
      row.slug = await generateUniqueSlug(supabase, "properties", fields.title || "nemovitost");

      const { data, error } = await supabase
        .from("properties")
        .insert(row)
        .select("id, slug")
        .maybeSingle();

      if (error) return errResult(error.message, warnings, started);
      propertyId = data?.id;
    }

    // Download and upload images to R2
    if (images.length > 0 && propertyId) {
      const { results, warnings: imgWarnings } = await downloadImages(images, propertyId);
      warnings.push(...imgWarnings);

      const successUrls = results.filter((r) => r.ok || r.url).map((r) => r.url);
      if (successUrls.length > 0) {
        await supabase
          .from("properties")
          .update({
            image_src: successUrls[0],
            images: successUrls,
          })
          .eq("id", propertyId);
      }
    }

    const finalSlug = existing?.slug ?? row.slug;

    return {
      status: warnings.length > 0 ? "warning" : "success",
      errors: [],
      warnings,
      nemovizorId: propertyId ?? null,
      nemovizorSlug: finalSlug ?? null,
      action: existing ? "updated" : "created",
      processingTimeMs: Date.now() - started,
    };
  } catch (err) {
    return errResult(err instanceof Error ? err.message : String(err), warnings, started);
  }
}

function errResult(msg: string, warnings: string[], started: number): ImportItemResult {
  return {
    status: "error",
    errors: [msg],
    warnings,
    nemovizorId: null,
    nemovizorSlug: null,
    action: null,
    processingTimeMs: Date.now() - started,
  };
}
