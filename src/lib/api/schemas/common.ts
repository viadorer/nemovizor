import "../openapi-registry"; // ensure extendZodWithOpenApi() has run
import { z } from "zod";
import { registry } from "../openapi-registry";

// ─── Enums ────────────────────────────────────────────────────────────────

export const ListingTypeSchema = z
  .enum(["sale", "rent", "auction", "shares", "project"])
  .openapi("ListingType", {
    description:
      "Type of listing. `sale` = for sale, `rent` = for rent, `auction` = dražba, `shares` = podíly (share sale), `project` = new-build project.",
  });

export const CategorySchema = z
  .enum(["apartment", "house", "land", "commercial", "other"])
  .openapi("Category", {
    description: "Property category.",
  });

export const SortSchema = z
  .enum([
    "featured",
    "price_asc",
    "price_desc",
    "newest",
    "oldest",
    "area_desc",
    "area_asc",
  ])
  .openapi("PropertySort", {
    description:
      "Sort order. `featured` (default): featured listings first, then newest.",
  });

// ─── Shared error envelope ─────────────────────────────────────────────────

export const ApiErrorSchema = z
  .object({
    error: z.object({
      code: z
        .enum([
          "VALIDATION_ERROR",
          "NOT_FOUND",
          "UNAUTHORIZED",
          "FORBIDDEN",
          "RATE_LIMITED",
          "SERVICE_UNAVAILABLE",
          "INTERNAL_ERROR",
        ])
        .openapi({ description: "Stable error code." }),
      message: z.string().openapi({ description: "Human-readable error message." }),
      details: z
        .unknown()
        .optional()
        .openapi({ description: "Optional machine-readable details (e.g. Zod issues)." }),
    }),
  })
  .openapi("ApiError", {
    description: "Standard error response envelope used by all v1 endpoints.",
  });

registry.register("ApiError", ApiErrorSchema);
registry.register("ListingType", ListingTypeSchema);
registry.register("Category", CategorySchema);
registry.register("PropertySort", SortSchema);

// ─── Reusable query-param helpers ──────────────────────────────────────────

/** A query-string number that may arrive as a string; coerces to finite number. */
export const qNumber = () =>
  z
    .string()
    .regex(/^-?\d+(?:\.\d+)?$/u, { message: "Expected numeric string" })
    .transform((s) => Number(s))
    .refine((n) => Number.isFinite(n), { message: "Not a finite number" });

/** A query-string integer (1+). */
export const qPositiveInt = () =>
  z
    .string()
    .regex(/^\d+$/u, { message: "Expected positive integer" })
    .transform((s) => parseInt(s, 10))
    .refine((n) => n >= 1, { message: "Must be >= 1" });

/**
 * A query-string "list" field that accepts comma-separated values and
 * returns a non-empty `string[]`.
 */
export const qCsvList = () =>
  z
    .string()
    .min(1)
    .transform((s) =>
      s
        .split(",")
        .map((v) => v.trim())
        .filter((v) => v.length > 0),
    )
    .refine((arr) => arr.length > 0, { message: "At least one value required" });
