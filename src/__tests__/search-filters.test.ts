import { describe, it, expect } from "vitest";

describe("Search Filters", () => {
  type SearchFilters = {
    listing_type?: string;
    categories?: string;
    countries?: string;
    city?: string;
    price_min?: number;
    price_max?: number;
    area_min?: number;
    area_max?: number;
    sort?: string;
  };

  function buildQueryString(filters: SearchFilters): string {
    const params = new URLSearchParams();
    if (filters.listing_type) params.set("listing_type", filters.listing_type);
    if (filters.categories) params.set("categories", filters.categories);
    if (filters.countries) params.set("countries", filters.countries);
    if (filters.city) params.set("city", filters.city);
    if (filters.price_min) params.set("price_min", String(filters.price_min));
    if (filters.price_max) params.set("price_max", String(filters.price_max));
    if (filters.area_min) params.set("area_min", String(filters.area_min));
    if (filters.area_max) params.set("area_max", String(filters.area_max));
    if (filters.sort) params.set("sort", filters.sort);
    return params.toString();
  }

  it("builds correct query for basic sale search", () => {
    const qs = buildQueryString({ listing_type: "sale", countries: "cz" });
    expect(qs).toContain("listing_type=sale");
    expect(qs).toContain("countries=cz");
  });

  it("builds correct query with price range", () => {
    const qs = buildQueryString({
      listing_type: "rent",
      price_min: 10000,
      price_max: 25000,
      countries: "fr",
    });
    expect(qs).toContain("price_min=10000");
    expect(qs).toContain("price_max=25000");
  });

  it("omits empty filters", () => {
    const qs = buildQueryString({ listing_type: "sale" });
    expect(qs).not.toContain("countries");
    expect(qs).not.toContain("price_min");
  });

  it("handles multiple countries", () => {
    const qs = buildQueryString({ countries: "cz,sk,pl" });
    expect(qs).toContain("countries=cz%2Csk%2Cpl");
  });
});

describe("Map Bounds Snapshot", () => {
  type MapBounds = { north: number; south: number; east: number; west: number; zoom: number };

  it("serializes/deserializes correctly", () => {
    const bounds: MapBounds = {
      north: 50.15,
      south: 49.85,
      east: 14.65,
      west: 14.15,
      zoom: 12,
    };
    const json = JSON.stringify(bounds);
    const parsed = JSON.parse(json) as MapBounds;
    expect(parsed.north).toBe(50.15);
    expect(parsed.zoom).toBe(12);
  });

  it("converts to bbox params", () => {
    const bounds: MapBounds = { north: 50.15, south: 49.85, east: 14.65, west: 14.15, zoom: 12 };
    const params = new URLSearchParams({
      sw_lat: String(bounds.south),
      sw_lon: String(bounds.west),
      ne_lat: String(bounds.north),
      ne_lon: String(bounds.east),
      zoom: String(bounds.zoom),
    });
    expect(params.get("sw_lat")).toBe("49.85");
    expect(params.get("ne_lon")).toBe("14.65");
  });
});

describe("Search History Deduplication", () => {
  it("ignores duplicate searches within 60s", () => {
    let lastKey = "";
    let lastTime = 0;

    function shouldRecord(key: string, now: number): boolean {
      if (key === lastKey && now - lastTime < 60_000) return false;
      lastKey = key;
      lastTime = now;
      return true;
    }

    const filters1 = JSON.stringify({ listing_type: "sale", countries: "cz" });
    const t0 = Date.now();

    expect(shouldRecord(filters1, t0)).toBe(true);
    expect(shouldRecord(filters1, t0 + 30_000)).toBe(false); // same, within 60s
    expect(shouldRecord(filters1, t0 + 61_000)).toBe(true); // same, but after 60s

    const filters2 = JSON.stringify({ listing_type: "rent", countries: "cz" });
    expect(shouldRecord(filters2, t0 + 35_000)).toBe(true); // different filters
  });
});
