import "../openapi-registry";
import { z } from "zod";
import { registry } from "../openapi-registry";
import {
  CategorySchema,
  ListingTypeSchema,
  SortSchema,
  qCsvList,
  qNumber,
  qPositiveInt,
} from "./common";

// ─── Query ─────────────────────────────────────────────────────────────────

/**
 * GET /api/properties query schema.
 *
 * NOTE: All filters are OPTIONAL and additive. The handler currently accepts
 * unknown query params (ignores them), so this schema uses `.strict()` NO —
 * we intentionally allow unknown keys to stay non-breaking.
 */
export const PropertiesQuerySchema = z
  .object({
    page: qPositiveInt().optional().openapi({ description: "Page number, 1-based.", example: "1" }),
    limit: z
      .string()
      .regex(/^\d+$/u)
      .transform((s) => parseInt(s, 10))
      .refine((n) => n >= 1 && n <= 100, { message: "limit must be 1..100" })
      .optional()
      .openapi({ description: "Page size (max 100).", example: "24" }),

    listing_type: ListingTypeSchema.optional(),
    category: qCsvList().optional().openapi({
      description: "Single category or comma-separated list, e.g. `apartment,house`.",
    }),
    subtype: qCsvList().optional().openapi({
      description: "Single subtype or comma-separated list, e.g. `2+kk,3+kk`.",
    }),
    city: z.string().min(1).optional(),
    country: qCsvList().optional().openapi({
      description: "Single ISO country code or comma-separated list, e.g. `cz,sk`.",
    }),

    broker_id: z.string().uuid().optional(),
    agency_id: z.string().uuid().optional(),

    price_min: qNumber().optional(),
    price_max: qNumber().optional(),
    area_min: qNumber().optional(),
    area_max: qNumber().optional(),

    // Map viewport bbox
    sw_lat: qNumber().optional(),
    sw_lon: qNumber().optional(),
    ne_lat: qNumber().optional(),
    ne_lon: qNumber().optional(),

    sort: SortSchema.optional(),

    // Cursor pagination — when present, takes precedence over `page`.
    cursor: z
      .string()
      .min(1)
      .optional()
      .openapi({
        description:
          "Opaque pagination cursor returned in the previous response's `next_cursor`/`nextCursor` field. When present, the response is sorted by `(created_at desc, id desc)` and `page`/`sort` are ignored.",
      }),
  })
  .passthrough()
  .openapi("PropertiesQuery");

// ─── Response DTOs ─────────────────────────────────────────────────────────

/**
 * Public broker summary embedded in property responses.
 *
 * SECURITY: Does NOT include `phone` / `email`. Those PII fields are
 * available only via the explicit `GET /api/v1/brokers/{id}/contact`
 * endpoint which has its own per-IP anti-harvesting rate limit.
 */
export const BrokerSummarySchema = z
  .object({
    id: z.string().uuid(),
    name: z.string(),
    slug: z.string().nullable(),
    photo: z.string().nullable(),
    agency_name: z.string().nullable(),
    rating: z.number().nullable().optional(),
    bio: z.string().nullable().optional(),
    active_listings: z.number().int().nonnegative().nullable().optional(),
    specialization: z.string().nullable().optional(),
  })
  .passthrough()
  .openapi("BrokerSummary");

/**
 * Descriptive schema of a single listing as returned by GET /api/properties.
 * The handler currently returns `SELECT *` from the `properties` table, so this
 * schema documents the well-known fields but uses `.passthrough()` to permit
 * extra columns without breaking validation.
 */
export const PropertyDtoSchema = z
  .object({
    id: z.string().uuid(),
    slug: z.string(),
    title: z.string(),
    listing_type: ListingTypeSchema.nullable().optional(),
    category: CategorySchema.nullable().optional(),
    subtype: z.string().nullable().optional(),
    rooms_label: z.string().nullable().optional(),

    price: z.number().nullable().optional(),
    price_note: z.string().nullable().optional(),
    price_currency: z.string().nullable().optional(),
    price_unit: z.string().nullable().optional(),
    price_negotiation: z.boolean().nullable().optional(),

    city: z.string().nullable().optional(),
    district: z.string().nullable().optional(),
    street: z.string().nullable().optional(),
    zip: z.string().nullable().optional(),
    region: z.string().nullable().optional(),
    city_part: z.string().nullable().optional(),
    country: z.string().nullable().optional(),
    location_label: z.string().nullable().optional(),

    latitude: z.number().nullable().optional(),
    longitude: z.number().nullable().optional(),

    area: z.number().nullable().optional(),
    land_area: z.number().nullable().optional(),
    built_up_area: z.number().nullable().optional(),
    floor_area: z.number().nullable().optional(),

    summary: z.string().nullable().optional(),
    description: z.string().nullable().optional(),

    condition: z.string().nullable().optional(),
    ownership: z.string().nullable().optional(),
    furnishing: z.string().nullable().optional(),
    energy_rating: z.string().nullable().optional(),

    featured: z.boolean().nullable().optional(),
    featured_until: z.string().nullable().optional(),
    active: z.boolean().nullable().optional(),

    created_at: z.string().nullable().optional(),
    updated_at: z.string().nullable().optional(),

    image_src: z.string().nullable().optional(),
    images: z.array(z.string()).nullable().optional(),

    broker_id: z.string().uuid().nullable().optional(),
    brokers: BrokerSummarySchema.nullable().optional(),
  })
  .passthrough()
  .openapi("PropertyDto", {
    description:
      "A single property listing. The endpoint returns the raw Supabase row plus nested `brokers` summary; additional columns may appear here and will be passed through unchanged.",
  });

export const PropertiesResponseSchema = z
  .object({
    data: z.array(PropertyDtoSchema),
    total: z.number().int().nonnegative().openapi({ description: "Total rows matching the filters." }),
    page: z.number().int().positive(),
    pages: z.number().int().nonnegative(),
    limit: z.number().int().positive(),
    next_cursor: z
      .string()
      .nullable()
      .optional()
      .openapi({
        description:
          "Opaque cursor for the next page when iterating with cursor pagination. `null` on the last page; absent when offset pagination was used.",
      }),
  })
  .openapi("PropertiesResponse");

/**
 * Single-property detail response (used by /api/v1/properties/{id} and
 * /api/v1/properties/by-slug/{slug}).
 */
export const PropertyDetailResponseSchema = z
  .object({
    data: PropertyDtoSchema,
  })
  .openapi("PropertyDetailResponse");

registry.register("BrokerSummary", BrokerSummarySchema);
registry.register("PropertyDto", PropertyDtoSchema);
registry.register("PropertiesQuery", PropertiesQuerySchema);
registry.register("PropertiesResponse", PropertiesResponseSchema);
registry.register("PropertyDetailResponse", PropertyDetailResponseSchema);
