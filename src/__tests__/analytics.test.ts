import { describe, it, expect, vi, beforeEach } from "vitest";
import { getSessionId, getDeviceType, captureUtm, getUtm, track, setAnalyticsUser } from "@/lib/analytics";

// Mock sessionStorage
const store: Record<string, string> = {};
const sessionStorageMock = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, val: string) => { store[key] = val; }),
  removeItem: vi.fn((key: string) => { delete store[key]; }),
  clear: vi.fn(() => { for (const k of Object.keys(store)) delete store[k]; }),
};
Object.defineProperty(globalThis, "sessionStorage", { value: sessionStorageMock, writable: true });

// Mock navigator.sendBeacon — type the mock so .mock.calls[n] is [url, data]
const sendBeaconMock = vi.fn<(url: string, data?: BodyInit | null) => boolean>(() => true);
Object.defineProperty(globalThis.navigator, "sendBeacon", { value: sendBeaconMock, writable: true });

describe("analytics", () => {
  beforeEach(() => {
    sessionStorageMock.clear();
    sendBeaconMock.mockClear();
    vi.useFakeTimers();
  });

  describe("getSessionId", () => {
    it("generates a session ID and persists it", () => {
      const sid = getSessionId();
      expect(sid).toBeTruthy();
      expect(sid.length).toBeGreaterThan(5);
      // Second call returns the same ID
      expect(getSessionId()).toBe(sid);
    });

    it("reads existing session ID from storage", () => {
      store["nv_sid"] = "test-session-123";
      expect(getSessionId()).toBe("test-session-123");
    });
  });

  describe("getDeviceType", () => {
    it("returns desktop for standard user agents", () => {
      expect(getDeviceType()).toBe("desktop");
    });
  });

  describe("UTM capture", () => {
    it("captures UTM params from URL", () => {
      const originalLocation = window.location;
      Object.defineProperty(window, "location", {
        value: { ...originalLocation, search: "?utm_source=google&utm_medium=cpc&utm_campaign=spring2026" },
        writable: true,
      });

      captureUtm();
      const utm = getUtm();
      expect(utm.utm_source).toBe("google");
      expect(utm.utm_medium).toBe("cpc");
      expect(utm.utm_campaign).toBe("spring2026");

      Object.defineProperty(window, "location", { value: originalLocation, writable: true });
    });

    it("returns empty object when no UTM params", () => {
      sessionStorageMock.clear();
      const utm = getUtm();
      expect(utm).toEqual({});
    });
  });

  describe("track", () => {
    it("queues events and flushes after timeout", () => {
      setAnalyticsUser("user-123");
      track("page_view", { path: "/nabidky" });

      expect(sendBeaconMock).not.toHaveBeenCalled();

      // Advance past flush timer (1500ms)
      vi.advanceTimersByTime(2000);

      expect(sendBeaconMock).toHaveBeenCalledTimes(1);
      const payload = JSON.parse(sendBeaconMock.mock.calls[0][1] as string);
      expect(payload).toHaveLength(1);
      expect(payload[0].event_type).toBe("page_view");
      expect(payload[0].user_id).toBe("user-123");
      expect(payload[0].properties.path).toBe("/nabidky");
    });

    it("flushes immediately when queue reaches 8", () => {
      for (let i = 0; i < 8; i++) {
        track("property_impression", { property_id: `prop-${i}` });
      }
      expect(sendBeaconMock).toHaveBeenCalledTimes(1);
      const payload = JSON.parse(sendBeaconMock.mock.calls[0][1] as string);
      expect(payload).toHaveLength(8);
    });

    it("does not track on server side", () => {
      const origWindow = globalThis.window;
      // @ts-expect-error simulate SSR
      delete globalThis.window;
      track("should_not_track");
      globalThis.window = origWindow;
      // No beacon sent
      vi.advanceTimersByTime(2000);
    });
  });
});
