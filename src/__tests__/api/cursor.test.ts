import { describe, expect, it } from "vitest";
import { decodeCursor, encodeCursor, type CursorPayload } from "@/lib/api/cursor";

const sample: CursorPayload = {
  createdAt: "2026-04-07T18:42:13.123456+00:00",
  id: "00000000-0000-0000-0000-0000000000aa",
};

describe("encodeCursor / decodeCursor", () => {
  it("round-trips a valid payload", () => {
    const encoded = encodeCursor(sample);
    expect(typeof encoded).toBe("string");
    expect(encoded.length).toBeGreaterThan(20);
    const decoded = decodeCursor(encoded);
    expect(decoded).toEqual(sample);
  });

  it("produces a base64url string with no '+', '/' or '='", () => {
    const encoded = encodeCursor(sample);
    expect(encoded).not.toMatch(/[+/=]/);
  });

  it("decodes null/undefined as null", () => {
    expect(decodeCursor(null)).toBeNull();
    expect(decodeCursor(undefined)).toBeNull();
    expect(decodeCursor("")).toBeNull();
  });

  it("decodes garbage as null (doesn't throw)", () => {
    expect(decodeCursor("not-base64-at-all!!")).toBeNull();
    expect(decodeCursor("aGVsbG8gd29ybGQ")).toBeNull();
    expect(decodeCursor(base64Json({ wrong: "shape" }))).toBeNull();
  });

  it("rejects payload with invalid uuid", () => {
    expect(
      decodeCursor(base64Json({ c: sample.createdAt, i: "not-a-uuid" })),
    ).toBeNull();
  });

  it("rejects payload with invalid date", () => {
    expect(
      decodeCursor(base64Json({ c: "not-a-date", i: sample.id })),
    ).toBeNull();
  });

  it("encodeCursor throws on invalid input", () => {
    expect(() => encodeCursor({ createdAt: "bad", id: sample.id })).toThrow();
    expect(() => encodeCursor({ createdAt: sample.createdAt, id: "bad" })).toThrow();
  });

  it("two different payloads produce different cursors", () => {
    const a = encodeCursor(sample);
    const b = encodeCursor({ ...sample, id: "00000000-0000-0000-0000-0000000000bb" });
    expect(a).not.toBe(b);
  });
});

function base64Json(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj), "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/u, "");
}
