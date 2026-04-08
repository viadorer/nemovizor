import { z } from "zod";
import { KNOWN_SCOPES } from "@/lib/api/api-key";

// Admin CRUD schemas — not registered in the public OpenAPI spec
// because this is an admin-only surface.

const ScopeEnum = z.enum(KNOWN_SCOPES);

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
  scopes: z
    .array(ScopeEnum)
    .min(1)
    .optional()
    .describe(
      'Permission scopes (default: ["read:public"]). Allowed values: read:public, read:broker, write:broker, read:admin, write:webhooks.',
    ),
});

export const RevokeApiKeyBodySchema = z.object({
  id: z.string().uuid(),
});
