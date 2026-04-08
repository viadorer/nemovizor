import { describe, expect, it } from "vitest";
import {
  MAX_ATTEMPTS,
  isTerminalFailure,
  nextAttemptAt,
} from "@/lib/api/webhooks/backoff";

const NOW = 1_700_000_000_000; // arbitrary fixed timestamp

describe("nextAttemptAt", () => {
  it("attempt 1 → +1 minute", () => {
    const next = nextAttemptAt(1, NOW)!;
    expect(next.getTime() - NOW).toBe(60_000);
  });

  it("attempt 2 → +5 minutes", () => {
    const next = nextAttemptAt(2, NOW)!;
    expect(next.getTime() - NOW).toBe(5 * 60_000);
  });

  it("attempt 3 → +30 minutes", () => {
    const next = nextAttemptAt(3, NOW)!;
    expect(next.getTime() - NOW).toBe(30 * 60_000);
  });

  it("attempt 4 → +2 hours", () => {
    const next = nextAttemptAt(4, NOW)!;
    expect(next.getTime() - NOW).toBe(2 * 60 * 60_000);
  });

  it("attempt 5 → null (last allowed)", () => {
    expect(nextAttemptAt(5, NOW)).toBeNull();
  });

  it("attempt 6 and beyond → null", () => {
    expect(nextAttemptAt(6, NOW)).toBeNull();
    expect(nextAttemptAt(100, NOW)).toBeNull();
  });

  it("attempt 0 or negative → null (defensive)", () => {
    expect(nextAttemptAt(0, NOW)).toBeNull();
    expect(nextAttemptAt(-3, NOW)).toBeNull();
  });

  it("schedule is monotonically increasing", () => {
    let last = 0;
    for (let n = 1; n < MAX_ATTEMPTS; n++) {
      const t = nextAttemptAt(n, NOW)!;
      const delta = t.getTime() - NOW;
      expect(delta).toBeGreaterThan(last);
      last = delta;
    }
  });
});

describe("isTerminalFailure", () => {
  it("attempts 1..4 are not terminal", () => {
    for (let n = 1; n < MAX_ATTEMPTS; n++) {
      expect(isTerminalFailure(n)).toBe(false);
    }
  });

  it("attempt MAX_ATTEMPTS is terminal", () => {
    expect(isTerminalFailure(MAX_ATTEMPTS)).toBe(true);
  });

  it("attempts beyond MAX_ATTEMPTS are terminal", () => {
    expect(isTerminalFailure(MAX_ATTEMPTS + 1)).toBe(true);
  });
});
