/**
 * analytics.ts — Client-side analytics helper
 *
 * Batches events and sends them via navigator.sendBeacon (or fetch fallback)
 * to /api/analytics/track. Works for both authenticated and anonymous users.
 */

const SESSION_KEY = "nv_sid";

// ─── Session ID ───────────────────────────────────────────────────────────────

export function getSessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    let sid = sessionStorage.getItem(SESSION_KEY);
    if (!sid) {
      sid = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
      sessionStorage.setItem(SESSION_KEY, sid);
    }
    return sid;
  } catch {
    return "nostore";
  }
}

// ─── Device detection ─────────────────────────────────────────────────────────

export function getDeviceType(): "mobile" | "tablet" | "desktop" {
  if (typeof window === "undefined") return "desktop";
  const ua = navigator.userAgent;
  if (/Mobi|Android|iPhone/i.test(ua)) return "mobile";
  if (/Tablet|iPad/i.test(ua)) return "tablet";
  return "desktop";
}

// ─── UTM capture (persisted in sessionStorage) ───────────────────────────────

const UTM_KEY = "nv_utm";

export function captureUtm(): void {
  if (typeof window === "undefined") return;
  try {
    const sp = new URLSearchParams(window.location.search);
    const utm: Record<string, string> = {};
    for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"]) {
      const v = sp.get(key);
      if (v) utm[key] = v;
    }
    if (Object.keys(utm).length > 0) {
      sessionStorage.setItem(UTM_KEY, JSON.stringify(utm));
    }
  } catch { /* ignore */ }
}

export function getUtm(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(UTM_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

// ─── Event queue + flush ──────────────────────────────────────────────────────

type EventRow = {
  session_id: string;
  user_id?: string | null;
  event_type: string;
  properties: Record<string, unknown>;
  url: string;
  referrer: string;
  device_type: string;
};

let _queue: EventRow[] = [];
let _flushTimer: ReturnType<typeof setTimeout> | null = null;
let _userId: string | null = null;

export function setAnalyticsUser(id: string | null) {
  _userId = id;
}

function send(rows: EventRow[]) {
  const payload = JSON.stringify(rows);
  if (navigator.sendBeacon) {
    navigator.sendBeacon("/api/analytics/track", payload);
  } else {
    fetch("/api/analytics/track", {
      method: "POST",
      body: payload,
      headers: { "Content-Type": "application/json" },
      keepalive: true,
    }).catch(() => {});
  }
}

function flush() {
  if (_queue.length === 0) return;
  const rows = _queue.splice(0);
  send(rows);
}

function scheduleFlush() {
  if (_flushTimer) clearTimeout(_flushTimer);
  if (_queue.length >= 8) {
    flush();
  } else {
    _flushTimer = setTimeout(flush, 1500);
  }
}

// ─── Main track function ──────────────────────────────────────────────────────

export type TrackProps = Record<string, string | number | boolean | null | undefined>;

export function track(eventType: string, properties: TrackProps = {}) {
  if (typeof window === "undefined") return;

  const utm = getUtm();
  const row: EventRow = {
    session_id: getSessionId(),
    user_id: _userId,
    event_type: eventType,
    properties: { ...utm, ...properties } as Record<string, unknown>,
    url: window.location.href,
    referrer: document.referrer || "",
    device_type: getDeviceType(),
  };

  _queue.push(row);
  scheduleFlush();
}

// Flush on tab hide / page unload
if (typeof window !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
  window.addEventListener("pagehide", flush);
}
