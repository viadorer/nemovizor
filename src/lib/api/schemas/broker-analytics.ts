import "../openapi-registry";
import { z } from "zod";
import { registry } from "../openapi-registry";

// ─── GET /api/broker/analytics-behavior ────────────────────────────────────

export const BrokerAnalyticsQuerySchema = z
  .object({
    broker_id: z.string().uuid().optional(),
    agency_id: z.string().uuid().optional(),
  })
  .passthrough()
  .refine((val) => !!val.broker_id || !!val.agency_id, {
    message: "broker_id or agency_id is required",
    path: ["broker_id"],
  })
  .openapi("BrokerAnalyticsQuery");

// Counted pairs used throughout the response
const CountPairSchema = z
  .object({ type: z.string(), count: z.number().int().nonnegative() })
  .openapi("EventCountPair");

const FunnelStepSchema = z
  .object({ step: z.string(), sessions: z.number().int().nonnegative() })
  .openapi("FunnelStep");

const DailyViewPointSchema = z
  .object({
    date: z.string().openapi({ description: "ISO YYYY-MM-DD." }),
    views: z.number().int().nonnegative(),
  })
  .openapi("DailyViewPoint");

const TopPropertySchema = z
  .object({
    id: z.string().uuid(),
    count: z.number().int().nonnegative(),
    title: z.string(),
    price: z.number(),
    price_currency: z.string(),
    image_src: z.string(),
    listing_type: z.string(),
    category: z.string(),
    area: z.number(),
    rooms_label: z.string(),
    slug: z.string(),
    city: z.string(),
  })
  .passthrough()
  .openapi("TopPropertyAnalyticsRow");

export const BrokerAnalyticsResponseSchema = z
  .object({
    totalProperties: z.number().int().nonnegative(),
    total7d: z.number().int().nonnegative(),
    uniqueSessions: z.number().int().nonnegative(),
    propViews7d: z.number().int().nonnegative(),
    impressions7d: z.number().int().nonnegative(),
    contactClicks: z.number().int().nonnegative(),
    favActions: z.number().int().nonnegative(),
    mapClicks: z.number().int().nonnegative(),
    avgScrollDepth: z.number().int().nonnegative(),
    avgTimeOnPage: z.number().int().nonnegative(),
    eventBreakdown: z.array(CountPairSchema),
    deviceCounts: z.record(z.string(), z.number().int().nonnegative()),
    topProperties: z.array(TopPropertySchema),
    hourCounts: z.array(z.number().int().nonnegative()),
    funnel: z.array(FunnelStepSchema),
    dailyViews: z.array(DailyViewPointSchema),
    contactRequests: z.number().int().nonnegative(),
    newContactRequests: z.number().int().nonnegative(),
  })
  .openapi("BrokerAnalyticsResponse");

registry.register("EventCountPair", CountPairSchema);
registry.register("FunnelStep", FunnelStepSchema);
registry.register("DailyViewPoint", DailyViewPointSchema);
registry.register("TopPropertyAnalyticsRow", TopPropertySchema);
registry.register("BrokerAnalyticsQuery", BrokerAnalyticsQuerySchema);
registry.register("BrokerAnalyticsResponse", BrokerAnalyticsResponseSchema);
