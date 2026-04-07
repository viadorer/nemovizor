import "../openapi-registry";
import { z } from "zod";
import { registry } from "../openapi-registry";

// ─── POST /api/valuation/estimate ──────────────────────────────────────────

export const ValuationPropertyTypeSchema = z
  .enum(["flat", "house", "land"])
  .openapi("ValuationPropertyType", { description: "Valuation property type accepted by the RealVisor/Valuo backend." });

export const ValuationKindSchema = z
  .enum(["sale", "rent"])
  .openapi("ValuationKind", { description: "Whether this is a sale or a rent valuation." });

export const ValuationEstimateBodySchema = z
  .object({
    propertyType: ValuationPropertyTypeSchema,
    lat: z.number().gte(-90).lte(90),
    lng: z.number().gte(-180).lte(180),
    /** Required for flat/house — optional for land (uses lotArea instead). */
    floorArea: z.number().positive().optional(),
    lotArea: z.number().positive().optional(),
    rating: z.number().min(0).max(10).optional(),
    kind: ValuationKindSchema.optional().default("sale"),

    email: z.string().email({ message: "Platný email je povinný" }),
    name: z.string().optional(),
    lastName: z.string().optional(),
    phone: z.string().optional(),

    address: z.string().optional(),
    street: z.string().optional(),
    city: z.string().optional(),
    district: z.string().optional(),
    region: z.string().optional(),
    postalCode: z.string().optional(),

    // Flat-specific
    localType: z.string().optional(),
    ownership: z.string().optional(),
    // House-specific
    houseType: z.string().optional(),
    // Land-specific
    landType: z.string().optional(),

    // Shared optional
    construction: z.string().optional(),
    floor: z.number().int().optional(),
    totalFloors: z.number().int().positive().optional(),
    elevator: z.boolean().optional(),
    energyPerformance: z.string().optional(),
    equipment: z.boolean().optional(),
    easyAccess: z.boolean().optional(),

    loggiaArea: z.number().nonnegative().optional(),
    balconyArea: z.number().nonnegative().optional(),
    terraceArea: z.number().nonnegative().optional(),
    cellarArea: z.number().nonnegative().optional(),
    gardenArea: z.number().nonnegative().optional(),

    rooms: z.number().int().nonnegative().optional(),
    bathrooms: z.number().int().nonnegative().optional(),
    garages: z.number().int().nonnegative().optional(),
    parkingSpaces: z.number().int().nonnegative().optional(),

    userId: z.string().uuid().optional(),
  })
  .passthrough()
  .superRefine((val, ctx) => {
    if (val.propertyType !== "land" && !val.floorArea) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["floorArea"],
        message: "floorArea is required for flat and house valuations",
      });
    }
  })
  .openapi("ValuationEstimateBody", {
    description:
      "Request body for the RealVisor/Valuo-backed property valuation. `floorArea` is required for `flat` and `house`; `land` uses `lotArea` instead.",
  });

export const ValuationEstimateResultSchema = z
  .object({
    avg_price: z.number(),
    min_price: z.number(),
    max_price: z.number(),
    avg_price_m2: z.number(),
    range_price: z.tuple([z.number(), z.number()]),
    currency: z.string(),
    calc_area: z.number(),
    as_of: z.string().openapi({ description: "ISO YYYY-MM-DD date the valuation was computed for." }),
  })
  .openapi("ValuationEstimateResult");

export const ValuationEstimateResponseSchema = z
  .object({
    success: z.literal(true),
    valuationId: z.string().uuid().nullable(),
    result: ValuationEstimateResultSchema,
  })
  .openapi("ValuationEstimateResponse");

// ─── GET /api/valuation/status ─────────────────────────────────────────────

export const ValuationStatusQuerySchema = z
  .object({
    id: z.string().uuid().openapi({ description: "Valuation report UUID returned by POST /api/valuation/estimate." }),
  })
  .openapi("ValuationStatusQuery");

export const ValuationStatusResponseSchema = z
  .object({
    id: z.string().uuid(),
    pdf_url: z.string().url().nullable(),
    paid: z.boolean(),
    ready: z.boolean(),
  })
  .openapi("ValuationStatusResponse");

registry.register("ValuationPropertyType", ValuationPropertyTypeSchema);
registry.register("ValuationKind", ValuationKindSchema);
registry.register("ValuationEstimateBody", ValuationEstimateBodySchema);
registry.register("ValuationEstimateResult", ValuationEstimateResultSchema);
registry.register("ValuationEstimateResponse", ValuationEstimateResponseSchema);
registry.register("ValuationStatusQuery", ValuationStatusQuerySchema);
registry.register("ValuationStatusResponse", ValuationStatusResponseSchema);
