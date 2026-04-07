import { z } from "zod";

// Admin CRUD schemas — not registered in the public OpenAPI spec
// because this is an admin-only surface.

export const CreateApiKeyBodySchema = z.object({
  name: z.string().min(1).max(200),
  owner_type: z.enum(["broker", "agency"]),
  owner_id: z.string().uuid(),
  rate_limit_per_min: z.number().int().positive().max(100_000).optional(),
  expires_at: z
    .string()
    .datetime()
    .nullable()
    .optional()
    .describe("ISO 8601 timestamp, or null for no expiration."),
});

export const RevokeApiKeyBodySchema = z.object({
  id: z.string().uuid(),
});
