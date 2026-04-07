import { describe, expect, it } from "vitest";
import { LeadsBodySchema } from "@/lib/api/schemas/leads";
import {
  AnalyticsEventSchema,
  AnalyticsTrackBodySchema,
} from "@/lib/api/schemas/analytics-track";
import { BrokerAnalyticsQuerySchema } from "@/lib/api/schemas/broker-analytics";
import {
  ValuationEstimateBodySchema,
  ValuationStatusQuerySchema,
} from "@/lib/api/schemas/valuation";

describe("LeadsBodySchema", () => {
  it("accepts a minimal valid lead", () => {
    const r = LeadsBodySchema.parse({ name: "Jan", email: "jan@example.com" });
    expect(r.name).toBe("Jan");
  });

  it("rejects missing email", () => {
    const r = LeadsBodySchema.safeParse({ name: "Jan" });
    expect(r.success).toBe(false);
  });

  it("rejects invalid email", () => {
    const r = LeadsBodySchema.safeParse({ name: "Jan", email: "not-an-email" });
    expect(r.success).toBe(false);
  });
});

describe("AnalyticsEventSchema / AnalyticsTrackBodySchema", () => {
  const good = { session_id: "abc", event_type: "property_view" };

  it("accepts a single event", () => {
    const r = AnalyticsTrackBodySchema.parse(good);
    expect((r as { session_id: string }).session_id).toBe("abc");
  });

  it("accepts an array of events", () => {
    const r = AnalyticsTrackBodySchema.parse([good, good]);
    expect(Array.isArray(r)).toBe(true);
  });

  it("rejects event missing session_id", () => {
    const r = AnalyticsEventSchema.safeParse({ event_type: "x" });
    expect(r.success).toBe(false);
  });
});

describe("BrokerAnalyticsQuerySchema", () => {
  it("accepts broker_id", () => {
    const r = BrokerAnalyticsQuerySchema.parse({
      broker_id: "00000000-0000-0000-0000-000000000000",
    });
    expect(r.broker_id).toBeDefined();
  });

  it("accepts agency_id", () => {
    const r = BrokerAnalyticsQuerySchema.parse({
      agency_id: "00000000-0000-0000-0000-000000000000",
    });
    expect(r.agency_id).toBeDefined();
  });

  it("rejects when neither broker_id nor agency_id is present", () => {
    const r = BrokerAnalyticsQuerySchema.safeParse({});
    expect(r.success).toBe(false);
  });

  it("rejects malformed UUID", () => {
    const r = BrokerAnalyticsQuerySchema.safeParse({ broker_id: "not-a-uuid" });
    expect(r.success).toBe(false);
  });
});

describe("ValuationEstimateBodySchema", () => {
  const basic = {
    propertyType: "flat" as const,
    lat: 50.08,
    lng: 14.43,
    floorArea: 75,
    email: "owner@example.com",
  };

  it("accepts a flat valuation with floorArea", () => {
    const r = ValuationEstimateBodySchema.parse(basic);
    expect(r.propertyType).toBe("flat");
  });

  it("rejects flat without floorArea", () => {
    const { floorArea: _drop, ...rest } = basic;
    void _drop;
    const r = ValuationEstimateBodySchema.safeParse(rest);
    expect(r.success).toBe(false);
  });

  it("accepts land without floorArea", () => {
    const r = ValuationEstimateBodySchema.safeParse({
      propertyType: "land",
      lat: 50,
      lng: 14,
      email: "owner@example.com",
    });
    expect(r.success).toBe(true);
  });

  it("rejects invalid email", () => {
    const r = ValuationEstimateBodySchema.safeParse({ ...basic, email: "bogus" });
    expect(r.success).toBe(false);
  });
});

describe("ValuationStatusQuerySchema", () => {
  it("accepts a valid UUID", () => {
    const r = ValuationStatusQuerySchema.parse({
      id: "00000000-0000-0000-0000-000000000000",
    });
    expect(r.id).toBe("00000000-0000-0000-0000-000000000000");
  });

  it("rejects missing id", () => {
    const r = ValuationStatusQuerySchema.safeParse({});
    expect(r.success).toBe(false);
  });

  it("rejects non-UUID id", () => {
    const r = ValuationStatusQuerySchema.safeParse({ id: "not-a-uuid" });
    expect(r.success).toBe(false);
  });
});
