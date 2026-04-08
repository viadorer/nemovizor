import { describe, expect, it } from "vitest";
import { hashClientIp } from "@/lib/api/audit-log";

describe("hashClientIp", () => {
  it("returns a 64-char hex digest", () => {
    const h = hashClientIp("9.9.9.9");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic on the same day", () => {
    const date = new Date("2026-04-08T12:00:00Z");
    const a = hashClientIp("1.2.3.4", date);
    const b = hashClientIp("1.2.3.4", date);
    expect(a).toBe(b);
  });

  it("differs across days for the same IP (privacy-preserving rotation)", () => {
    const day1 = new Date("2026-04-08T12:00:00Z");
    const day2 = new Date("2026-04-09T12:00:00Z");
    const a = hashClientIp("1.2.3.4", day1);
    const b = hashClientIp("1.2.3.4", day2);
    expect(a).not.toBe(b);
  });

  it("differs for different IPs on the same day", () => {
    const date = new Date("2026-04-08T12:00:00Z");
    const a = hashClientIp("1.2.3.4", date);
    const b = hashClientIp("5.6.7.8", date);
    expect(a).not.toBe(b);
  });

  it("never returns the raw IP", () => {
    const ip = "192.168.1.1";
    const h = hashClientIp(ip);
    expect(h).not.toContain(ip);
    expect(h).not.toContain("192");
  });

  it("respects AUDIT_LOG_DAILY_SALT env var when set", () => {
    const date = new Date("2026-04-08T12:00:00Z");
    const ip = "10.0.0.1";

    const before = process.env.AUDIT_LOG_DAILY_SALT;
    try {
      process.env.AUDIT_LOG_DAILY_SALT = "salt-A";
      const a = hashClientIp(ip, date);
      process.env.AUDIT_LOG_DAILY_SALT = "salt-B";
      const b = hashClientIp(ip, date);
      expect(a).not.toBe(b);
    } finally {
      if (before === undefined) delete process.env.AUDIT_LOG_DAILY_SALT;
      else process.env.AUDIT_LOG_DAILY_SALT = before;
    }
  });
});
