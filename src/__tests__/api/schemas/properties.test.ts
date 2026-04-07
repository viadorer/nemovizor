import { describe, expect, it } from "vitest";
import { PropertiesQuerySchema } from "@/lib/api/schemas/properties";

describe("PropertiesQuerySchema", () => {
  it("parses an empty query with no defaults applied", () => {
    const result = PropertiesQuerySchema.parse({});
    expect(result.page).toBeUndefined();
    expect(result.limit).toBeUndefined();
  });

  it("parses a full valid query", () => {
    const result = PropertiesQuerySchema.parse({
      page: "2",
      limit: "50",
      listing_type: "sale",
      category: "apartment,house",
      subtype: "2+kk",
      city: "Praha",
      country: "cz,sk",
      price_min: "1000000",
      price_max: "5000000",
      area_min: "40.5",
      area_max: "120",
      sort: "price_asc",
    });
    expect(result.page).toBe(2);
    expect(result.limit).toBe(50);
    expect(result.listing_type).toBe("sale");
    expect(result.category).toEqual(["apartment", "house"]);
    expect(result.subtype).toEqual(["2+kk"]);
    expect(result.country).toEqual(["cz", "sk"]);
    expect(result.price_min).toBe(1000000);
    expect(result.area_min).toBe(40.5);
    expect(result.sort).toBe("price_asc");
  });

  it("rejects limit > 100", () => {
    const result = PropertiesQuerySchema.safeParse({ limit: "500" });
    expect(result.success).toBe(false);
  });

  it("rejects unknown listing_type enum value", () => {
    const result = PropertiesQuerySchema.safeParse({ listing_type: "bogus" });
    expect(result.success).toBe(false);
  });

  it("rejects non-numeric price_min", () => {
    const result = PropertiesQuerySchema.safeParse({ price_min: "abc" });
    expect(result.success).toBe(false);
  });

  it("rejects bad UUID for broker_id", () => {
    const result = PropertiesQuerySchema.safeParse({ broker_id: "not-a-uuid" });
    expect(result.success).toBe(false);
  });

  it("passes unknown extra params through without failing", () => {
    const result = PropertiesQuerySchema.parse({ tracking_id: "xyz" });
    expect(result).toBeDefined();
  });
});
