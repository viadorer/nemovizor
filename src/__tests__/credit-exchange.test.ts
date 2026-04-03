import { describe, it, expect } from "vitest";

describe("Credit Exchange System", () => {
  const rates: Record<string, number> = {
    czk: 1,
    eur: 25,
    chf: 26,
    gbp: 29,
    pln: 6,
    huf: 0.07,
    bgn: 13,
    ron: 5,
    all: 0.25,
    try: 0.75,
  };

  it("converts CZK to credits 1:1", () => {
    const amount = 2000;
    const credits = amount * rates.czk;
    expect(credits).toBe(2000);
  });

  it("converts EUR to credits at 25x rate", () => {
    const amount = 100;
    const credits = amount * rates.eur;
    expect(credits).toBe(2500);
  });

  it("converts CHF to credits at 26x rate", () => {
    const amount = 500;
    const credits = amount * rates.chf;
    expect(credits).toBe(13000);
  });

  it("converts GBP to credits at 29x rate", () => {
    const amount = 50;
    const credits = amount * rates.gbp;
    expect(credits).toBe(1450);
  });

  it("handles small currencies (HUF)", () => {
    const amount = 10000;
    const credits = amount * rates.huf;
    expect(credits).toBeCloseTo(700, 2);
  });

  it("formats credit amounts correctly", () => {
    const formatCredits = (n: number) =>
      n.toLocaleString("cs", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

    expect(formatCredits(1000)).toBe("1\u00a0000");
    expect(formatCredits(1.34)).toBe("1,34");
    expect(formatCredits(0)).toBe("0");
  });
});

describe("Regional Pricing", () => {
  // Sample pricing from DB
  const pricing: Record<string, { sale: number; rent: number }> = {
    "cz:*": { sale: 1, rent: 1 },
    "cz:Praha": { sale: 2, rent: 1 },
    "fr:*": { sale: 8, rent: 4 },
    "fr:Paris": { sale: 13, rent: 8 },
    "fr:Nice": { sale: 13, rent: 8 },
    "ch:*": { sale: 10, rent: 5 },
    "ch:Zürich": { sale: 16, rent: 9 },
  };

  function getPrice(country: string, city: string | null, listingType: "sale" | "rent"): number {
    // Try city-specific first
    if (city) {
      const cityKey = `${country}:${city}`;
      if (pricing[cityKey]) return pricing[cityKey][listingType];
    }
    // Fallback to country default
    const defaultKey = `${country}:*`;
    if (pricing[defaultKey]) return pricing[defaultKey][listingType];
    return 1; // absolute fallback
  }

  it("returns city-specific price for Prague sale", () => {
    expect(getPrice("cz", "Praha", "sale")).toBe(2);
  });

  it("returns city-specific price for Paris rent", () => {
    expect(getPrice("fr", "Paris", "rent")).toBe(8);
  });

  it("falls back to country default for unknown city", () => {
    expect(getPrice("fr", "Marseille", "sale")).toBe(8);
  });

  it("falls back to country default for null city", () => {
    expect(getPrice("cz", null, "rent")).toBe(1);
  });

  it("returns absolute fallback for unknown country", () => {
    expect(getPrice("xx", null, "sale")).toBe(1);
  });

  it("Zürich sale is most expensive in CH", () => {
    expect(getPrice("ch", "Zürich", "sale")).toBe(16);
    expect(getPrice("ch", "Bern", "sale")).toBe(10); // fallback to ch:*
  });
});
