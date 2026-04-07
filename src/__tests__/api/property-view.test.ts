import { describe, expect, it } from "vitest";
import {
  BROKER_PII_FIELDS,
  PROPERTY_BUSINESS_FIELDS,
  legacyPropertyView,
  legacyPropertyViewMany,
  publicBrokerSummary,
  v1PropertyView,
  v1PropertyViewMany,
} from "@/lib/api/property-view";

const sampleBroker = {
  id: "00000000-0000-0000-0000-000000000001",
  name: "Jan Novák",
  slug: "jan-novak",
  photo: "https://example.com/photo.jpg",
  agency_name: "RK Test",
  rating: 4.5,
  bio: "20 let zkušeností",
  active_listings: 42,
  phone: "+420777123456",
  email: "jan@example.com",
  personal_email: "private@example.com",
  agency_id: "00000000-0000-0000-0000-000000000999",
};

const sampleProperty = {
  id: "00000000-0000-0000-0000-0000000000aa",
  slug: "byt-3kk-praha",
  title: "Byt 3+kk",
  price: 5_000_000,
  city: "Praha",
  category: "apartment",
  listing_type: "sale",
  commission: 4.5,
  mortgage_percent: 80,
  spor_percent: 5,
  annuity: 25_000,
  cost_of_living: 4500,
  refundable_deposit: 50_000,
  created_by: "00000000-0000-0000-0000-000000000abc",
  brokers: sampleBroker,
};

describe("publicBrokerSummary", () => {
  it("returns null for null/undefined input", () => {
    expect(publicBrokerSummary(null)).toBeNull();
    expect(publicBrokerSummary(undefined)).toBeNull();
  });

  it("returns null for non-object input", () => {
    expect(publicBrokerSummary("string")).toBeNull();
    expect(publicBrokerSummary(42)).toBeNull();
    expect(publicBrokerSummary([])).toBeNull();
  });

  it("strips all PII fields", () => {
    const out = publicBrokerSummary(sampleBroker)!;
    for (const piiField of BROKER_PII_FIELDS) {
      expect(out).not.toHaveProperty(piiField);
    }
  });

  it("keeps public-safe fields", () => {
    const out = publicBrokerSummary(sampleBroker)!;
    expect(out.id).toBe(sampleBroker.id);
    expect(out.name).toBe(sampleBroker.name);
    expect(out.slug).toBe(sampleBroker.slug);
    expect(out.photo).toBe(sampleBroker.photo);
    expect(out.agency_name).toBe(sampleBroker.agency_name);
    expect(out.rating).toBe(sampleBroker.rating);
    expect(out.bio).toBe(sampleBroker.bio);
    expect(out.active_listings).toBe(sampleBroker.active_listings);
  });

  it("does not leak agency_id (internal FK)", () => {
    const out = publicBrokerSummary(sampleBroker)!;
    expect(out).not.toHaveProperty("agency_id");
  });
});

describe("legacyPropertyView", () => {
  it("removes broker PII but keeps business fields", () => {
    const out = legacyPropertyView(sampleProperty);

    // Business fields preserved (legacy backwards compat)
    for (const field of PROPERTY_BUSINESS_FIELDS) {
      expect(out).toHaveProperty(field);
    }
    expect(out.commission).toBe(4.5);
    expect(out.mortgage_percent).toBe(80);

    // Broker PII stripped
    const brokers = out.brokers as Record<string, unknown>;
    expect(brokers).not.toHaveProperty("phone");
    expect(brokers).not.toHaveProperty("email");
    expect(brokers).not.toHaveProperty("personal_email");
    expect(brokers.name).toBe("Jan Novák");
  });

  it("handles missing broker gracefully", () => {
    const { brokers: _drop, ...rest } = sampleProperty;
    void _drop;
    const out = legacyPropertyView(rest);
    expect(out).not.toHaveProperty("brokers");
    expect(out.title).toBe("Byt 3+kk");
  });

  it("handles null broker", () => {
    const out = legacyPropertyView({ ...sampleProperty, brokers: null });
    expect(out.brokers).toBeNull();
  });

  it("does not mutate the input row", () => {
    const before = JSON.parse(JSON.stringify(sampleProperty));
    legacyPropertyView(sampleProperty);
    expect(sampleProperty).toEqual(before);
  });
});

describe("v1PropertyView", () => {
  it("removes business fields", () => {
    const out = v1PropertyView(sampleProperty);
    for (const field of PROPERTY_BUSINESS_FIELDS) {
      expect(out).not.toHaveProperty(field);
    }
  });

  it("removes broker PII", () => {
    const out = v1PropertyView(sampleProperty);
    const brokers = out.brokers as Record<string, unknown>;
    for (const piiField of BROKER_PII_FIELDS) {
      expect(brokers).not.toHaveProperty(piiField);
    }
  });

  it("keeps non-sensitive fields intact", () => {
    const out = v1PropertyView(sampleProperty);
    expect(out.id).toBe(sampleProperty.id);
    expect(out.title).toBe(sampleProperty.title);
    expect(out.price).toBe(sampleProperty.price);
    expect(out.city).toBe(sampleProperty.city);
    expect(out.category).toBe(sampleProperty.category);
    expect(out.listing_type).toBe(sampleProperty.listing_type);
  });

  it("does not mutate the input row", () => {
    const before = JSON.parse(JSON.stringify(sampleProperty));
    v1PropertyView(sampleProperty);
    expect(sampleProperty).toEqual(before);
  });
});

describe("legacyPropertyViewMany / v1PropertyViewMany", () => {
  it("applies the filter to every row", () => {
    const rows = [sampleProperty, sampleProperty, sampleProperty];

    const legacy = legacyPropertyViewMany(rows);
    expect(legacy).toHaveLength(3);
    legacy.forEach((row) => {
      expect((row.brokers as Record<string, unknown>)).not.toHaveProperty("phone");
      expect(row.commission).toBe(4.5);
    });

    const v1 = v1PropertyViewMany(rows);
    expect(v1).toHaveLength(3);
    v1.forEach((row) => {
      expect(row).not.toHaveProperty("commission");
      expect((row.brokers as Record<string, unknown>)).not.toHaveProperty("phone");
    });
  });

  it("returns an empty array for empty input", () => {
    expect(legacyPropertyViewMany([])).toEqual([]);
    expect(v1PropertyViewMany([])).toEqual([]);
  });
});
