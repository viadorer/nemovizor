import { describe, expect, it } from "vitest";
import { matchesFilter } from "@/lib/api/webhooks/filter";

const sample = {
  id: "00000000-0000-0000-0000-0000000000aa",
  slug: "byt-3kk-praha",
  title: "Byt 3+kk",
  category: "apartment",
  subtype: "3+kk",
  city: "Praha",
  country: "cz",
  listing_type: "sale",
  price: 5_000_000,
  area: 75,
  broker_id: "00000000-0000-0000-0000-000000000001",
};

describe("matchesFilter — null / empty", () => {
  it("matches everything when filter is null", () => {
    expect(matchesFilter(sample, null)).toBe(true);
  });

  it("matches everything when filter is undefined", () => {
    expect(matchesFilter(sample, undefined)).toBe(true);
  });

  it("matches everything when filter is empty object", () => {
    expect(matchesFilter(sample, {})).toBe(true);
  });
});

describe("matchesFilter — array OR", () => {
  it("category matches when value is in the allowed list", () => {
    expect(matchesFilter(sample, { category: ["apartment", "house"] })).toBe(true);
  });

  it("category fails when value is not in the list", () => {
    expect(matchesFilter(sample, { category: ["land", "commercial"] })).toBe(false);
  });

  it("country with single value", () => {
    expect(matchesFilter(sample, { country: ["cz"] })).toBe(true);
    expect(matchesFilter(sample, { country: ["sk"] })).toBe(false);
  });

  it("subtype filter", () => {
    expect(matchesFilter(sample, { subtype: ["3+kk", "2+kk"] })).toBe(true);
    expect(matchesFilter(sample, { subtype: ["1+1"] })).toBe(false);
  });
});

describe("matchesFilter — exact match", () => {
  it("city is exact-match", () => {
    expect(matchesFilter(sample, { city: "Praha" })).toBe(true);
    expect(matchesFilter(sample, { city: "Brno" })).toBe(false);
  });

  it("listing_type is exact-match", () => {
    expect(matchesFilter(sample, { listing_type: "sale" })).toBe(true);
    expect(matchesFilter(sample, { listing_type: "rent" })).toBe(false);
  });

  it("broker_id is exact-match (UUID)", () => {
    expect(matchesFilter(sample, { broker_id: sample.broker_id })).toBe(true);
    expect(matchesFilter(sample, { broker_id: "00000000-0000-0000-0000-000000000999" })).toBe(false);
  });
});

describe("matchesFilter — numeric range", () => {
  it("price within range", () => {
    expect(matchesFilter(sample, { price_min: 1_000_000, price_max: 10_000_000 })).toBe(true);
  });

  it("price below min fails", () => {
    expect(matchesFilter(sample, { price_min: 6_000_000 })).toBe(false);
  });

  it("price above max fails", () => {
    expect(matchesFilter(sample, { price_max: 4_000_000 })).toBe(false);
  });

  it("price exactly equal to min/max passes (inclusive)", () => {
    expect(matchesFilter(sample, { price_min: 5_000_000, price_max: 5_000_000 })).toBe(true);
  });

  it("area within range", () => {
    expect(matchesFilter(sample, { area_min: 50, area_max: 100 })).toBe(true);
    expect(matchesFilter(sample, { area_min: 100 })).toBe(false);
  });
});

describe("matchesFilter — AND across keys", () => {
  it("all conditions met → matches", () => {
    expect(
      matchesFilter(sample, {
        category: ["apartment"],
        country: ["cz"],
        city: "Praha",
        price_max: 10_000_000,
        area_min: 50,
      }),
    ).toBe(true);
  });

  it("one condition fails → entire filter fails", () => {
    expect(
      matchesFilter(sample, {
        category: ["apartment"],
        country: ["cz"],
        city: "Brno", // wrong
        price_max: 10_000_000,
      }),
    ).toBe(false);
  });
});

describe("matchesFilter — missing payload fields", () => {
  it("missing field with no constraint → matches", () => {
    const noPrice = { ...sample, price: null };
    expect(matchesFilter(noPrice, { city: "Praha" })).toBe(true);
  });

  it("missing field with constraint → fails", () => {
    const noPrice = { ...sample, price: null };
    expect(matchesFilter(noPrice, { price_max: 1_000_000 })).toBe(false);
  });

  it("missing string field with constraint → fails", () => {
    const noCity = { ...sample, city: null };
    expect(matchesFilter(noCity, { city: "Praha" })).toBe(false);
  });
});
