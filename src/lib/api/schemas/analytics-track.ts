import "../openapi-registry";
import { z } from "zod";
import { registry } from "../openapi-registry";

// ─── POST /api/analytics/track ─────────────────────────────────────────────

export const AnalyticsEventSchema = z
  .object({
    session_id: z.string().min(1).max(64).openapi({ description: "Stable client session id." }),
    user_id: z.string().uuid().nullable().optional(),
    event_type: z
      .string()
      .min(1)
      .max(64)
      .openapi({ description: "Event type identifier, e.g. `property_view`, `phone_click`, `favorite_toggle`." }),
    properties: z.record(z.string(), z.unknown()).optional(),
    url: z.string().max(500).optional(),
    referrer: z.string().max(500).optional(),
    device_type: z.string().max(16).optional(),
  })
  .passthrough()
  .openapi("AnalyticsEvent");

/** Body may be a single event or an array. */
export const AnalyticsTrackBodySchema = z
  .union([AnalyticsEventSchema, z.array(AnalyticsEventSchema)])
  .openapi("AnalyticsTrackBody", {
    description: "A single analytics event or an array of events. Events missing `session_id` or `event_type` are silently dropped.",
  });

export const AnalyticsTrackResponseSchema = z
  .object({
    ok: z.literal(true),
  })
  .openapi("AnalyticsTrackResponse");

registry.register("AnalyticsEvent", AnalyticsEventSchema);
registry.register("AnalyticsTrackBody", AnalyticsTrackBodySchema);
registry.register("AnalyticsTrackResponse", AnalyticsTrackResponseSchema);
