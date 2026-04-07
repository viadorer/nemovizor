import { describe, expect, it } from "vitest";
import { AiSearchBodySchema } from "@/lib/api/schemas/ai-search";

describe("AiSearchBodySchema", () => {
  it("accepts a normal query", () => {
    const result = AiSearchBodySchema.parse({ query: "Byt v Praze do 5 milionů" });
    expect(result.query).toBe("Byt v Praze do 5 milionů");
  });

  it("trims whitespace before length checks", () => {
    const result = AiSearchBodySchema.parse({ query: "   byt Praha   " });
    expect(result.query).toBe("byt Praha");
  });

  it("rejects query shorter than 3 chars after trim", () => {
    const result = AiSearchBodySchema.safeParse({ query: "  ab  " });
    expect(result.success).toBe(false);
  });

  it("rejects query longer than 500 chars", () => {
    const result = AiSearchBodySchema.safeParse({ query: "a".repeat(501) });
    expect(result.success).toBe(false);
  });

  it("rejects missing query field", () => {
    const result = AiSearchBodySchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects non-string query", () => {
    const result = AiSearchBodySchema.safeParse({ query: 42 });
    expect(result.success).toBe(false);
  });
});
