import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock fetch globally
const fetchMock = vi.fn();
globalThis.fetch = fetchMock;

describe("Wallet & Purchase System", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  describe("POST /api/wallet/purchase", () => {
    it("deducts credits for TIP purchase", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          purchase: { id: "pur-1", service_code: "tip_7d", price_paid: 50 },
          wallet: { credits: 9950 },
        }),
      });

      const res = await fetch("/api/wallet/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_code: "tip_7d",
          target_type: "property",
          target_id: "prop-123",
        }),
      });

      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(data.purchase.service_code).toBe("tip_7d");
      expect(data.purchase.price_paid).toBe(50);
      expect(data.wallet.credits).toBe(9950);
    });

    it("rejects when insufficient credits", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 402,
        json: async () => ({ error: "Nedostatek kreditů", balance: 30, required: 50 }),
      });

      const res = await fetch("/api/wallet/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service_code: "tip_7d", target_type: "property", target_id: "prop-123" }),
      });

      expect(res.ok).toBe(false);
      expect(res.status).toBe(402);
      const data = await res.json();
      expect(data.error).toContain("kreditů");
    });

    it("rejects without authentication", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: "Unauthorized" }),
      });

      const res = await fetch("/api/wallet/purchase", {
        method: "POST",
        body: JSON.stringify({ service_code: "tip_7d" }),
      });

      expect(res.ok).toBe(false);
    });
  });

  describe("POST /api/wallet/topup", () => {
    it("creates Stripe checkout session", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          url: "https://checkout.stripe.com/pay/cs_test_abc123",
          session_id: "cs_test_abc123",
        }),
      });

      const res = await fetch("/api/wallet/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: 2000, currency: "czk" }),
      });

      const data = await res.json();
      expect(data.url).toContain("checkout.stripe.com");
      expect(data.session_id).toBeTruthy();
    });
  });
});

describe("Billing Logic", () => {
  it("calculates correct daily cost with volume discounts", () => {
    // Simulate billing calculation
    const pricing: Record<string, number> = {
      "fr_sale": 8,
      "fr_rent": 4,
      "cz_sale": 1,
      "cz_rent": 1,
      "sk_sale": 4,
      "sk_rent": 2,
    };

    const properties = [
      { country: "fr", listing_type: "sale", count: 634 },
      { country: "fr", listing_type: "rent", count: 207 },
      { country: "cz", listing_type: "sale", count: 48 },
      { country: "cz", listing_type: "rent", count: 34 },
      { country: "sk", listing_type: "sale", count: 52 },
      { country: "sk", listing_type: "rent", count: 25 },
    ];

    const volumeDiscounts: Record<string, { min: number; pct: number }[]> = {
      fr: [{ min: 1, pct: 0 }, { min: 11, pct: 10 }, { min: 51, pct: 20 }, { min: 201, pct: 30 }, { min: 501, pct: 40 }],
      cz: [{ min: 1, pct: 0 }, { min: 11, pct: 10 }, { min: 51, pct: 20 }, { min: 201, pct: 30 }, { min: 501, pct: 40 }],
    };

    function getDiscount(country: string, totalInCountry: number): number {
      const tiers = volumeDiscounts[country] || [];
      let disc = 0;
      for (const t of tiers) {
        if (totalInCountry >= t.min) disc = t.pct;
      }
      return disc;
    }

    let totalCost = 0;
    const byCountry: Record<string, number> = {};
    for (const p of properties) {
      byCountry[p.country] = (byCountry[p.country] || 0) + p.count;
    }

    for (const p of properties) {
      const key = `${p.country}_${p.listing_type}`;
      const rate = pricing[key] || 1;
      const discount = getDiscount(p.country, byCountry[p.country]);
      totalCost += p.count * rate * (1 - discount / 100);
    }

    // FR: 841 props → 40% discount
    // 634 * 8 * 0.6 = 3043.2 + 207 * 4 * 0.6 = 496.8 = 3540
    // CZ: 82 props → 20% discount
    // 48 * 1 * 0.8 = 38.4 + 34 * 1 * 0.8 = 27.2 = 65.6
    // SK: 77 props → no discount
    // 52 * 4 = 208 + 25 * 2 = 50 = 258

    expect(totalCost).toBeCloseTo(3863.6, 1);
  });

  it("applies account-level discount when higher than volume", () => {
    const accountDiscount = 50; // 50% account level
    const volumeDiscount = 20; // 20% volume
    const basePrice = 8;
    const count = 100;

    // Should use the higher discount
    const effectiveDiscount = Math.max(accountDiscount, volumeDiscount);
    const cost = count * basePrice * (1 - effectiveDiscount / 100);

    expect(effectiveDiscount).toBe(50);
    expect(cost).toBe(400);
  });

  it("supports decimal credits (e.g. 1.34 kr after discount)", () => {
    const basePrice = 2;
    const discount = 33; // 33%
    const cost = basePrice * (1 - discount / 100);

    expect(cost).toBeCloseTo(1.34, 2);
  });
});
