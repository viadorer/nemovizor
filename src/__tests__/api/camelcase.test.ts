import { describe, expect, it } from "vitest";
import {
  toCamelCase,
  toCamelKey,
  toSnakeCase,
  toSnakeKey,
} from "@/lib/api/camelcase";

describe("toCamelKey / toSnakeKey", () => {
  it("round-trips common keys", () => {
    const cases: [string, string][] = [
      ["listing_type", "listingType"],
      ["price_currency", "priceCurrency"],
      ["avg_price_m2", "avgPriceM2"],
      ["featured_until", "featuredUntil"],
      ["broker_id", "brokerId"],
      ["sw_lat", "swLat"],
    ];
    for (const [snake, camel] of cases) {
      expect(toCamelKey(snake)).toBe(camel);
      expect(toSnakeKey(camel)).toBe(snake);
    }
  });

  it("is idempotent when called on its own output", () => {
    expect(toCamelKey("listingType")).toBe("listingType");
    expect(toSnakeKey("listing_type")).toBe("listing_type");
  });
});

describe("toCamelCase", () => {
  it("transforms flat objects", () => {
    expect(toCamelCase({ foo_bar: 1, baz_qux: "x" })).toEqual({ fooBar: 1, bazQux: "x" });
  });

  it("transforms nested objects", () => {
    expect(toCamelCase({ a_b: { c_d: { e_f: 42 } } })).toEqual({
      aB: { cD: { eF: 42 } },
    });
  });

  it("traverses arrays", () => {
    expect(toCamelCase({ items: [{ inner_key: 1 }, { inner_key: 2 }] })).toEqual({
      items: [{ innerKey: 1 }, { innerKey: 2 }],
    });
  });

  it("leaves primitives alone", () => {
    expect(toCamelCase(42)).toBe(42);
    expect(toCamelCase("hello")).toBe("hello");
    expect(toCamelCase(null)).toBe(null);
    expect(toCamelCase(undefined)).toBe(undefined);
  });

  it("does not rewrite string VALUES that look like snake_case", () => {
    const out = toCamelCase({ price_currency: "czk", property_type: "house_with_garden" });
    expect(out).toEqual({ priceCurrency: "czk", propertyType: "house_with_garden" });
  });

  it("round-trips with toSnakeCase", () => {
    const original = { broker_id: "abc", price_range: [1, 2], nested_obj: { foo_bar: "x" } };
    const camel = toCamelCase(original);
    expect(toSnakeCase(camel)).toEqual(original);
  });
});

describe("toSnakeCase", () => {
  it("transforms flat objects", () => {
    expect(toSnakeCase({ fooBar: 1, bazQux: "x" })).toEqual({ foo_bar: 1, baz_qux: "x" });
  });

  it("traverses arrays", () => {
    expect(toSnakeCase([{ innerKey: 1 }, { innerKey: 2 }])).toEqual([
      { inner_key: 1 },
      { inner_key: 2 },
    ]);
  });
});
