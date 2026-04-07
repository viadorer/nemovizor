import "../openapi-registry";
import { z } from "zod";
import { registry } from "../openapi-registry";
import {
  CategorySchema,
  ListingTypeSchema,
  qCsvList,
  qNumber,
} from "./common";

// ─── Query ─────────────────────────────────────────────────────────────────

export const MapPointsQuerySchema = z
  .object({
    zoom: z
      .string()
      .regex(/^\d+$/u)
      .transform((s) => parseInt(s, 10))
      .refine((n) => n >= 1 && n <= 20, { message: "zoom must be 1..20" })
      .optional()
      .openapi({ description: "Map zoom level 1..20. zoom >= 13 limits to 500 pins.", example: "7" }),

    listing_type: ListingTypeSchema.optional(),
    category: qCsvList().optional(),
    subtype: qCsvList().optional(),
    city: z.string().min(1).optional(),
    country: qCsvList().optional(),

    broker_id: z.string().uuid().optional(),
    agency_id: z.string().uuid().optional(),

    price_min: qNumber().optional(),
    price_max: qNumber().optional(),
    area_min: qNumber().optional(),
    area_max: qNumber().optional(),

    sw_lat: qNumber().optional(),
    sw_lon: qNumber().optional(),
    ne_lat: qNumber().optional(),
    ne_lon: qNumber().optional(),
  })
  .passthrough()
  .openapi("MapPointsQuery");

// ─── Response DTOs ─────────────────────────────────────────────────────────

export const MapPointDtoSchema = z
  .object({
    id: z.string().uuid(),
    lat: z.number(),
    lon: z.number(),
    price: z.number().nullable(),
    price_currency: z.string().nullable(),
    category: CategorySchema.nullable(),
    listing_type: ListingTypeSchema.nullable(),
    title: z.string(),
    slug: z.string(),
    rooms_label: z.string().nullable(),
    image_src: z.string().nullable(),
    subtype: z.string().nullable(),
    area: z.number().nullable(),
    district: z.string().nullable(),
  })
  .openapi("MapPointDto", {
    description: "Slim geo-point used for map markers. Minimal payload by design.",
  });

export const MapPointsResponseSchema = z
  .object({
    points: z.array(MapPointDtoSchema),
    count: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
    truncated: z
      .boolean()
      .openapi({ description: "True if result was capped at the pin-limit for this zoom." }),
  })
  .openapi("MapPointsResponse");

registry.register("MapPointDto", MapPointDtoSchema);
registry.register("MapPointsQuery", MapPointsQuerySchema);
registry.register("MapPointsResponse", MapPointsResponseSchema);
