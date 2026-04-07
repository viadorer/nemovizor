import "../openapi-registry";
import { z } from "zod";
import { registry } from "../openapi-registry";
import { CategorySchema, ListingTypeSchema } from "./common";

// ─── Request body ──────────────────────────────────────────────────────────

export const AiSearchBodySchema = z
  .object({
    query: z
      .string()
      .transform((s) => s.trim())
      .pipe(
        z
          .string()
          .min(3, { message: "Query too short" })
          .max(500, { message: "Query too long" }),
      )
      .openapi({
        description:
          "Natural-language real-estate query in any supported language (Czech, Slovak, English, French, German, Italian, Spanish …). Trimmed; 3..500 chars after trimming.",
        example: "Byt 2+kk nebo 3+kk v Praze do 8 milionů",
      }),
  })
  .openapi("AiSearchBody");

// ─── Response ──────────────────────────────────────────────────────────────

export const AiSearchFiltersSchema = z
  .object({
    listingType: ListingTypeSchema.optional(),
    category: CategorySchema.optional(),
    subtypes: z.array(z.string()).optional(),
    city: z.string().optional(),
    country: z.string().optional().openapi({ description: "ISO 3166-1 alpha-2 country code, lowercase." }),
    priceMin: z.number().positive().optional(),
    priceMax: z.number().positive().optional(),
    areaMin: z.number().positive().optional(),
    areaMax: z.number().positive().optional(),
  })
  .openapi("AiSearchFilters", {
    description: "Structured filters extracted from the natural-language query. All fields optional.",
  });

export const AiSearchResponseSchema = z
  .object({
    filters: AiSearchFiltersSchema,
    explanation: z.string().openapi({
      description:
        "Short one-sentence summary of what the model understood, rendered in the user's input language.",
    }),
  })
  .openapi("AiSearchResponse");

registry.register("AiSearchBody", AiSearchBodySchema);
registry.register("AiSearchFilters", AiSearchFiltersSchema);
registry.register("AiSearchResponse", AiSearchResponseSchema);
