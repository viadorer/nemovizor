import "../openapi-registry";
import { z } from "zod";
import { registry } from "../openapi-registry";

// ─── POST /api/leads ───────────────────────────────────────────────────────

export const LeadsBodySchema = z
  .object({
    name: z.string().min(1).openapi({ description: "Contact full name." }),
    email: z.string().email(),
    phone: z.string().min(1).optional(),
    propertyType: z
      .string()
      .optional()
      .openapi({ description: "Free-form property type (e.g. 'byt', 'dum', 'pozemek')." }),
    intent: z
      .string()
      .optional()
      .openapi({ description: "Why the lead is reaching out — 'prodat', 'koupit', 'ocenit', 'pronajmout', 'odhad'." }),
    address: z.string().optional(),
    note: z.string().max(2000).optional(),
    source: z
      .string()
      .optional()
      .openapi({ description: "Origin of the lead (e.g. 'prodat-page', 'nemovizor-oceneni')." }),
  })
  .passthrough()
  .openapi("LeadsBody");

export const LeadsResponseSchema = z
  .object({
    ok: z.literal(true),
  })
  .openapi("LeadsResponse");

registry.register("LeadsBody", LeadsBodySchema);
registry.register("LeadsResponse", LeadsResponseSchema);
