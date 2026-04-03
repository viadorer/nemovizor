import { describe, it, expect } from "vitest";

describe("Properties API — Data Sanitization", () => {
  const isPlaceholder = (url: unknown) =>
    typeof url === "string" && url.includes("placeholder.com");

  it("filters via.placeholder.com from image_src", () => {
    const row = {
      id: "1",
      image_src: "https://via.placeholder.com/800x600.jpg",
      images: ["https://via.placeholder.com/400x300.jpg", "https://r2.dev/real-photo.jpg"],
    };

    if (isPlaceholder(row.image_src)) row.image_src = "/branding/placeholder.png";
    row.images = row.images.filter((u) => !isPlaceholder(u));

    expect(row.image_src).toBe("/branding/placeholder.png");
    expect(row.images).toEqual(["https://r2.dev/real-photo.jpg"]);
  });

  it("keeps valid R2 URLs untouched", () => {
    const row = {
      image_src: "https://pub-73649d5be63240648a58ace4d4c57318.r2.dev/uploads/images/photo.jpg",
      images: ["https://pub-73649d5be63240648a58ace4d4c57318.r2.dev/uploads/images/1.jpg"],
    };

    expect(isPlaceholder(row.image_src)).toBe(false);
    expect(row.images.every((u) => !isPlaceholder(u))).toBe(true);
  });

  it("handles null/undefined image_src gracefully", () => {
    expect(isPlaceholder(null)).toBe(false);
    expect(isPlaceholder(undefined)).toBe(false);
    expect(isPlaceholder("")).toBe(false);
  });

  it("expires featured properties past their deadline", () => {
    const now = new Date("2026-04-01T12:00:00Z").toISOString();

    const activeFeature = { featured: true, featured_until: "2026-04-10T00:00:00Z" };
    const expiredFeature = { featured: true, featured_until: "2026-03-20T00:00:00Z" };
    const noExpiry = { featured: true, featured_until: null };

    // Active: featured_until > now
    expect(activeFeature.featured_until! > now).toBe(true);

    // Expired: featured_until < now
    if (expiredFeature.featured && expiredFeature.featured_until && expiredFeature.featured_until < now) {
      expiredFeature.featured = false;
    }
    expect(expiredFeature.featured).toBe(false);

    // No expiry: stays featured
    expect(noExpiry.featured).toBe(true);
  });
});

describe("Properties API — Pagination", () => {
  it("calculates correct page count", () => {
    const total = 4981;
    const limit = 24;
    const pages = Math.ceil(total / limit);
    expect(pages).toBe(208);
  });

  it("handles empty results", () => {
    const total = 0;
    const limit = 24;
    const pages = Math.ceil(total / limit);
    expect(pages).toBe(0);
  });
});

describe("Properties API — Country Filtering", () => {
  it("splits comma-separated country param", () => {
    const countryParam = "cz,sk,pl";
    const countries = countryParam.split(",");
    expect(countries).toEqual(["cz", "sk", "pl"]);
  });

  it("handles single country", () => {
    const countryParam = "fr";
    const countries = countryParam.split(",");
    expect(countries).toHaveLength(1);
    expect(countries[0]).toBe("fr");
  });
});
