import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/openapi/route";

describe("GET /api/openapi", () => {
  it("returns a valid OpenAPI 3.1 document with all public paths", async () => {
    const res = await GET();
    expect(res.status).toBe(200);

    type OpenApiDoc = {
      openapi: string;
      info: { title: string; version: string };
      paths: Record<string, Record<string, unknown>>;
      components?: { schemas?: Record<string, unknown> };
    };
    const doc = (await res.json()) as OpenApiDoc;

    expect(doc.openapi).toBe("3.1.0");
    expect(doc.info.title).toBe("Nemovizor API");
    expect(typeof doc.info.version).toBe("string");

    // Tier-1 paths (step 1-2)
    expect(doc.paths["/api/properties"].get).toBeDefined();
    expect(doc.paths["/api/map-points"].get).toBeDefined();
    expect(doc.paths["/api/filter-options"].get).toBeDefined();
    expect(doc.paths["/api/ai-search"].post).toBeDefined();

    // Tier-2 paths (step 4)
    expect(doc.paths["/api/valuation/estimate"].post).toBeDefined();
    expect(doc.paths["/api/valuation/status"].get).toBeDefined();
    expect(doc.paths["/api/leads"].post).toBeDefined();
    expect(doc.paths["/api/analytics/track"].post).toBeDefined();
    expect(doc.paths["/api/broker/analytics-behavior"].get).toBeDefined();

    // Phase 2 — detail endpoints + broker contact
    expect(doc.paths["/api/v1/properties/{id}"].get).toBeDefined();
    expect(doc.paths["/api/v1/properties/by-slug/{slug}"].get).toBeDefined();
    expect(doc.paths["/api/v1/brokers/{id}/contact"].get).toBeDefined();

    // Phase D — webhook subscriptions
    expect(doc.paths["/api/v1/webhooks"].post).toBeDefined();
    expect(doc.paths["/api/v1/webhooks"].get).toBeDefined();
    expect(doc.paths["/api/v1/webhooks/{id}"].get).toBeDefined();
    expect(doc.paths["/api/v1/webhooks/{id}"].patch).toBeDefined();
    expect(doc.paths["/api/v1/webhooks/{id}"].delete).toBeDefined();

    // Component schemas were registered
    const schemas = doc.components?.schemas ?? {};
    expect(schemas.ApiError).toBeDefined();
    expect(schemas.PropertiesResponse).toBeDefined();
    expect(schemas.PropertyDetailResponse).toBeDefined();
    expect(schemas.BrokerContactResponse).toBeDefined();
    expect(schemas.ValuationEstimateResponse).toBeDefined();
    expect(schemas.ValuationStatusResponse).toBeDefined();
    expect(schemas.LeadsResponse).toBeDefined();
    expect(schemas.AnalyticsTrackBody).toBeDefined();
    expect(schemas.BrokerAnalyticsResponse).toBeDefined();
  });
});
