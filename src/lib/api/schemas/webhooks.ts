import "../openapi-registry";
import { z } from "zod";
import { registry } from "../openapi-registry";
import { WEBHOOK_EVENT_TYPES } from "../webhooks/types";

// ─── Filter ────────────────────────────────────────────────────────────────

export const WebhookFilterSchema = z
  .object({
    category: z.array(z.string()).optional(),
    subtype: z.array(z.string()).optional(),
    city: z.string().optional(),
    country: z.array(z.string()).optional(),
    listing_type: z.string().optional(),
    price_min: z.number().nonnegative().optional(),
    price_max: z.number().nonnegative().optional(),
    area_min: z.number().nonnegative().optional(),
    area_max: z.number().nonnegative().optional(),
    broker_id: z.string().uuid().optional(),
  })
  .openapi("WebhookFilter", {
    description:
      "Optional filter applied per-subscription at dispatch time. All keys are AND-combined; array values are OR-combined; numeric _min/_max are inclusive.",
  });

// ─── Body shapes ───────────────────────────────────────────────────────────

const WebhookEventTypeEnum = z.enum(WEBHOOK_EVENT_TYPES);

export const CreateWebhookBodySchema = z
  .object({
    url: z
      .string()
      .url()
      .refine((u) => u.startsWith("https://"), {
        message: "Webhook URL must use HTTPS",
      })
      .openapi({ description: "Target HTTPS URL that will receive POST deliveries." }),
    event_types: z
      .array(WebhookEventTypeEnum)
      .min(1)
      .optional()
      .openapi({
        description: "Event types this subscription wants. Default: all property events.",
      }),
    filter: WebhookFilterSchema.nullable().optional(),
  })
  .openapi("CreateWebhookBody");

export const UpdateWebhookBodySchema = z
  .object({
    url: z
      .string()
      .url()
      .refine((u) => u.startsWith("https://"), { message: "Webhook URL must use HTTPS" })
      .optional(),
    event_types: z.array(WebhookEventTypeEnum).min(1).optional(),
    filter: WebhookFilterSchema.nullable().optional(),
    active: z.boolean().optional(),
  })
  .openapi("UpdateWebhookBody");

// ─── Response shapes ───────────────────────────────────────────────────────

export const WebhookSubscriptionDtoSchema = z
  .object({
    id: z.string().uuid(),
    url: z.string().url(),
    secret_prefix: z.string(),
    event_types: z.array(WebhookEventTypeEnum),
    filter: WebhookFilterSchema.nullable(),
    active: z.boolean(),
    failure_count: z.number().int().nonnegative(),
    disabled_at: z.string().nullable(),
    last_delivered_at: z.string().nullable(),
    created_at: z.string(),
  })
  .openapi("WebhookSubscriptionDto");

export const CreateWebhookResponseSchema = z
  .object({
    data: WebhookSubscriptionDtoSchema,
    secret: z
      .string()
      .openapi({
        description:
          "Plain webhook signing secret. Returned ONCE on creation; store it immediately. Used by your endpoint to verify the X-Nemovizor-Signature header.",
      }),
  })
  .openapi("CreateWebhookResponse");

export const WebhookListResponseSchema = z
  .object({
    data: z.array(WebhookSubscriptionDtoSchema),
  })
  .openapi("WebhookListResponse");

export const WebhookDetailResponseSchema = z
  .object({
    data: WebhookSubscriptionDtoSchema,
  })
  .openapi("WebhookDetailResponse");

registry.register("WebhookFilter", WebhookFilterSchema);
registry.register("CreateWebhookBody", CreateWebhookBodySchema);
registry.register("UpdateWebhookBody", UpdateWebhookBodySchema);
registry.register("WebhookSubscriptionDto", WebhookSubscriptionDtoSchema);
registry.register("CreateWebhookResponse", CreateWebhookResponseSchema);
registry.register("WebhookListResponse", WebhookListResponseSchema);
registry.register("WebhookDetailResponse", WebhookDetailResponseSchema);
