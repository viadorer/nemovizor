import "../openapi-registry";
import { z } from "zod";
import { registry } from "../openapi-registry";
import { ListingTypeSchema, qCsvList, qNumber } from "./common";

// ─── Query ─────────────────────────────────────────────────────────────────

export const FilterOptionsQuerySchema = z
  .object({
    listing_type: ListingTypeSchema.optional(),
    category: qCsvList().optional(),
    broker_id: z.string().uuid().optional(),
    agency_id: z.string().uuid().optional(),
    sw_lat: qNumber().optional(),
    sw_lon: qNumber().optional(),
    ne_lat: qNumber().optional(),
    ne_lon: qNumber().optional(),
  })
  .passthrough()
  .openapi("FilterOptionsQuery");

// ─── Response DTOs ─────────────────────────────────────────────────────────

const CountedValueSchema = z
  .object({
    value: z.string(),
    count: z.number().int().nonnegative(),
  })
  .openapi("CountedValue");

const NumericRangeSchema = z
  .object({
    min: z.number().nonnegative(),
    max: z.number().nonnegative(),
  })
  .openapi("NumericRange");

export const FilterOptionsResponseSchema = z
  .object({
    categories: z.array(CountedValueSchema),
    cities: z
      .array(CountedValueSchema)
      .openapi({ description: "Top 100 cities by count." }),
    subtypes: z.array(CountedValueSchema),
    listingTypes: z.array(CountedValueSchema),
    countries: z.array(CountedValueSchema).optional(),
    currencies: z.array(CountedValueSchema).optional(),
    priceRange: NumericRangeSchema,
    areaRange: NumericRangeSchema,
  })
  .openapi("FilterOptionsResponse");

registry.register("CountedValue", CountedValueSchema);
registry.register("NumericRange", NumericRangeSchema);
registry.register("FilterOptionsQuery", FilterOptionsQuerySchema);
registry.register("FilterOptionsResponse", FilterOptionsResponseSchema);
