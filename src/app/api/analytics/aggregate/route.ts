import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase-admin";

type Ev = {
  event_type: string;
  session_id: string;
  properties: Record<string, unknown>;
  url: string;
  referrer: string;
  device_type: string;
  created_at: string;
};

// Sentinel UUID used for global (unscoped) rows — matches DB default
const NIL = "00000000-0000-0000-0000-000000000000";

/**
 * POST /api/analytics/aggregate
 * Aggregates raw analytics_events for a given date into summary tables.
 * Produces global rows (broker_id=NIL, agency_id=NIL) plus per-broker and per-agency rows.
 * Body: { date?: "YYYY-MM-DD" }  — defaults to yesterday.
 * Auth: CRON_SECRET header or admin session.
 * Idempotent: uses UPSERT so re-running for the same date is safe.
 */
export async function POST(req: NextRequest) {
  // ── Auth ──
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = getAdminSupabase();
  if (!client) return NextResponse.json({ error: "No DB" }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const targetDate =
    (body as { date?: string }).date ||
    new Date(Date.now() - 86400_000).toISOString().slice(0, 10);

  const dayStart = `${targetDate}T00:00:00.000Z`;
  const dayEnd = `${targetDate}T23:59:59.999Z`;

  // ── Fetch all events for the target date ──
  const events: Ev[] = [];
  let page = 0;
  const PAGE_SIZE = 1000;
  while (true) {
    const { data: batch } = await client
      .from("analytics_events")
      .select("event_type, session_id, properties, url, referrer, device_type, created_at")
      .gte("created_at", dayStart)
      .lte("created_at", dayEnd)
      .order("created_at", { ascending: true })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    if (!batch || batch.length === 0) break;
    events.push(...(batch as Ev[]));
    if (batch.length < PAGE_SIZE) break;
    page++;
    if (page > 100) break;
  }

  if (events.length === 0) {
    return NextResponse.json({ ok: true, date: targetDate, eventsProcessed: 0 });
  }

  // ── Build property_id -> { broker_id, agency_id } map ──
  const eventPropertyIds = new Set<string>();
  for (const e of events) {
    const pid = String(e.properties?.property_id || "");
    if (pid) eventPropertyIds.add(pid);
  }

  type PropOwner = { broker_id: string; agency_id: string };
  const propOwnerMap = new Map<string, PropOwner>();
  const brokerAgencyMap = new Map<string, string>();

  if (eventPropertyIds.size > 0) {
    const pidArr = Array.from(eventPropertyIds);
    for (let i = 0; i < pidArr.length; i += 500) {
      const batch = pidArr.slice(i, i + 500);
      const { data } = await client
        .from("properties")
        .select("id, broker_id")
        .in("id", batch);
      if (data) {
        for (const p of data as { id: string; broker_id: string | null }[]) {
          const bid = p.broker_id || NIL;
          propOwnerMap.set(p.id, { broker_id: bid, agency_id: NIL });
          if (bid !== NIL) brokerAgencyMap.set(bid, NIL);
        }
      }
    }

    const brokerIds = Array.from(brokerAgencyMap.keys());
    for (let i = 0; i < brokerIds.length; i += 500) {
      const batch = brokerIds.slice(i, i + 500);
      const { data } = await client
        .from("brokers")
        .select("id, agency_id")
        .in("id", batch);
      if (data) {
        for (const b of data as { id: string; agency_id: string | null }[]) {
          brokerAgencyMap.set(b.id, b.agency_id || NIL);
        }
      }
    }

    // Fill agency_id into propOwnerMap
    for (const [pid, owner] of propOwnerMap) {
      if (owner.broker_id !== NIL) {
        owner.agency_id = brokerAgencyMap.get(owner.broker_id) ?? NIL;
      }
    }
  }

  // ── Scope helpers ──
  type Scope = { broker_id: string; agency_id: string };

  function getEventScopes(e: Ev): Scope[] {
    const scopes: Scope[] = [{ broker_id: NIL, agency_id: NIL }]; // always global
    const pid = String(e.properties?.property_id || "");
    if (pid) {
      const owner = propOwnerMap.get(pid);
      if (owner) {
        if (owner.broker_id !== NIL) {
          scopes.push({ broker_id: owner.broker_id, agency_id: NIL });
        }
        if (owner.agency_id !== NIL) {
          scopes.push({ broker_id: NIL, agency_id: owner.agency_id });
        }
      }
    }
    return scopes;
  }

  function scopeKey(s: Scope): string {
    return `${s.broker_id}|${s.agency_id}`;
  }

  function parseScopeKey(sk: string): { broker_id: string; agency_id: string } {
    const [broker_id, agency_id] = sk.split("|");
    return { broker_id, agency_id };
  }

  // Helper to upsert in batches
  async function batchUpsert(table: string, rows: Record<string, unknown>[], conflict: string) {
    for (let i = 0; i < rows.length; i += 500) {
      await client!.from(table).upsert(rows.slice(i, i + 500), { onConflict: conflict });
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // 1. analytics_daily_stats — event counts by type, per scope
  // ══════════════════════════════════════════════════════════════════════
  type StatsAcc = { count: number; sessions: Set<string>; desktop: number; mobile: number; tablet: number };
  const statsByScope = new Map<string, Map<string, StatsAcc>>();

  for (const e of events) {
    for (const scope of getEventScopes(e)) {
      const sk = scopeKey(scope);
      if (!statsByScope.has(sk)) statsByScope.set(sk, new Map());
      const byType = statsByScope.get(sk)!;
      if (!byType.has(e.event_type)) {
        byType.set(e.event_type, { count: 0, sessions: new Set(), desktop: 0, mobile: 0, tablet: 0 });
      }
      const s = byType.get(e.event_type)!;
      s.count++;
      s.sessions.add(e.session_id);
      const dt = (e.device_type || "").toLowerCase();
      if (dt === "desktop") s.desktop++;
      else if (dt === "mobile") s.mobile++;
      else if (dt === "tablet") s.tablet++;
    }
  }

  const statsRows: Record<string, unknown>[] = [];
  for (const [sk, byType] of statsByScope) {
    const { broker_id, agency_id } = parseScopeKey(sk);
    for (const [event_type, s] of byType) {
      statsRows.push({
        stat_date: targetDate,
        event_type,
        event_count: s.count,
        unique_sessions: s.sessions.size,
        device_desktop: s.desktop,
        device_mobile: s.mobile,
        device_tablet: s.tablet,
        broker_id,
        agency_id,
        updated_at: new Date().toISOString(),
      });
    }
  }

  await batchUpsert("analytics_daily_stats", statsRows, "stat_date,event_type,broker_id,agency_id");

  // ══════════════════════════════════════════════════════════════════════
  // 2. analytics_daily_top_pages — per scope
  // ══════════════════════════════════════════════════════════════════════
  const pagesByScope = new Map<string, Map<string, number>>();

  for (const e of events.filter((e) => e.event_type === "page_view")) {
    let pathname: string;
    try { pathname = new URL(e.url).pathname; } catch { continue; }
    for (const scope of getEventScopes(e)) {
      const sk = scopeKey(scope);
      if (!pagesByScope.has(sk)) pagesByScope.set(sk, new Map());
      const m = pagesByScope.get(sk)!;
      m.set(pathname, (m.get(pathname) || 0) + 1);
    }
  }

  const pageRows: Record<string, unknown>[] = [];
  for (const [sk, m] of pagesByScope) {
    const { broker_id, agency_id } = parseScopeKey(sk);
    for (const [page_path, view_count] of m) {
      pageRows.push({ stat_date: targetDate, page_path, view_count, broker_id, agency_id });
    }
  }

  if (pageRows.length > 0) {
    await batchUpsert("analytics_daily_top_pages", pageRows, "stat_date,page_path,broker_id,agency_id");
  }

  // ══════════════════════════════════════════════════════════════════════
  // 3. analytics_daily_top_properties — per scope
  // ══════════════════════════════════════════════════════════════════════
  type PropAcc = { count: number; slug: string; city: string };
  const propsByScope = new Map<string, Map<string, PropAcc>>();

  for (const e of events.filter((e) => e.event_type === "property_view")) {
    const pid = String(e.properties?.property_id || "");
    if (!pid) continue;
    for (const scope of getEventScopes(e)) {
      const sk = scopeKey(scope);
      if (!propsByScope.has(sk)) propsByScope.set(sk, new Map());
      const m = propsByScope.get(sk)!;
      if (!m.has(pid)) m.set(pid, { count: 0, slug: String(e.properties?.slug || ""), city: String(e.properties?.city || "") });
      m.get(pid)!.count++;
    }
  }

  const propRows: Record<string, unknown>[] = [];
  for (const [sk, m] of propsByScope) {
    const { broker_id, agency_id } = parseScopeKey(sk);
    for (const [property_id, d] of m) {
      propRows.push({ stat_date: targetDate, property_id, view_count: d.count, slug: d.slug, city: d.city, broker_id, agency_id });
    }
  }

  if (propRows.length > 0) {
    await batchUpsert("analytics_daily_top_properties", propRows, "stat_date,property_id,broker_id,agency_id");
  }

  // ══════════════════════════════════════════════════════════════════════
  // 4. analytics_daily_funnel — per scope
  // ══════════════════════════════════════════════════════════════════════
  type FunnelAcc = {
    pageViewSessions: Map<string, number>;
    impressions: Set<string>;
    details: Set<string>;
    contacts: Set<string>;
    scrollSum: number;
    scrollCount: number;
    timeSum: number;
    timeCount: number;
  };

  const funnelByScope = new Map<string, FunnelAcc>();

  function getFunnelAcc(sk: string): FunnelAcc {
    if (!funnelByScope.has(sk)) {
      funnelByScope.set(sk, {
        pageViewSessions: new Map(),
        impressions: new Set(),
        details: new Set(),
        contacts: new Set(),
        scrollSum: 0, scrollCount: 0,
        timeSum: 0, timeCount: 0,
      });
    }
    return funnelByScope.get(sk)!;
  }

  for (const e of events) {
    for (const scope of getEventScopes(e)) {
      const sk = scopeKey(scope);
      const acc = getFunnelAcc(sk);
      if (e.event_type === "page_view") {
        acc.pageViewSessions.set(e.session_id, (acc.pageViewSessions.get(e.session_id) || 0) + 1);
      }
      if (e.event_type === "property_impression") acc.impressions.add(e.session_id);
      if (e.event_type === "property_view") acc.details.add(e.session_id);
      if (["phone_click", "email_click", "contact_broker_click"].includes(e.event_type)) acc.contacts.add(e.session_id);
      if (e.event_type === "scroll_depth") {
        acc.scrollSum += Number(e.properties?.depth_pct) || 0;
        acc.scrollCount++;
      }
      if (e.event_type === "time_on_page") {
        acc.timeSum += Number(e.properties?.seconds) || 0;
        acc.timeCount++;
      }
    }
  }

  const funnelRows: Record<string, unknown>[] = [];
  for (const [sk, acc] of funnelByScope) {
    const { broker_id, agency_id } = parseScopeKey(sk);
    const totalSessions = acc.pageViewSessions.size;
    const bounceCount = Array.from(acc.pageViewSessions.values()).filter((c) => c === 1).length;
    const avgScroll = acc.scrollCount ? Math.round((acc.scrollSum / acc.scrollCount) * 100) / 100 : 0;
    const avgTime = acc.timeCount ? Math.round((acc.timeSum / acc.timeCount) * 100) / 100 : 0;

    funnelRows.push({
      stat_date: targetDate,
      sessions_total: totalSessions,
      sessions_impression: acc.impressions.size,
      sessions_detail: acc.details.size,
      sessions_contact: acc.contacts.size,
      bounce_count: bounceCount,
      avg_scroll_depth: avgScroll,
      avg_time_on_page: avgTime,
      broker_id,
      agency_id,
      updated_at: new Date().toISOString(),
    });
  }

  await batchUpsert("analytics_daily_funnel", funnelRows, "stat_date,broker_id,agency_id");

  // ══════════════════════════════════════════════════════════════════════
  // 5. analytics_daily_referrers — per scope
  // ══════════════════════════════════════════════════════════════════════
  const refByScope = new Map<string, Map<string, number>>();

  for (const e of events.filter((e) => e.event_type === "page_view")) {
    let source = "direct";
    if (e.referrer) {
      try { source = new URL(e.referrer).hostname.replace("www.", ""); } catch { source = e.referrer.slice(0, 50); }
    }
    if (source.includes("nemovizor") || source.includes("localhost")) continue;
    for (const scope of getEventScopes(e)) {
      const sk = scopeKey(scope);
      if (!refByScope.has(sk)) refByScope.set(sk, new Map());
      const m = refByScope.get(sk)!;
      m.set(source, (m.get(source) || 0) + 1);
    }
  }

  const refRows: Record<string, unknown>[] = [];
  for (const [sk, m] of refByScope) {
    const { broker_id, agency_id } = parseScopeKey(sk);
    for (const [source, visit_count] of m) {
      refRows.push({ stat_date: targetDate, source, visit_count, broker_id, agency_id });
    }
  }

  if (refRows.length > 0) {
    await batchUpsert("analytics_daily_referrers", refRows, "stat_date,source,broker_id,agency_id");
  }

  // ══════════════════════════════════════════════════════════════════════
  // 6. analytics_daily_hourly — per scope
  // ══════════════════════════════════════════════════════════════════════
  const hourByScope = new Map<string, Map<number, number>>();

  for (const e of events.filter((e) => e.event_type === "page_view")) {
    const h = new Date(e.created_at).getUTCHours();
    for (const scope of getEventScopes(e)) {
      const sk = scopeKey(scope);
      if (!hourByScope.has(sk)) hourByScope.set(sk, new Map());
      const m = hourByScope.get(sk)!;
      m.set(h, (m.get(h) || 0) + 1);
    }
  }

  const hourRows: Record<string, unknown>[] = [];
  for (const [sk, m] of hourByScope) {
    const { broker_id, agency_id } = parseScopeKey(sk);
    for (const [hour, count] of m) {
      hourRows.push({ stat_date: targetDate, hour_of_day: hour, event_count: count, broker_id, agency_id });
    }
  }

  if (hourRows.length > 0) {
    await batchUpsert("analytics_daily_hourly", hourRows, "stat_date,hour_of_day,broker_id,agency_id");
  }

  return NextResponse.json({
    ok: true,
    date: targetDate,
    eventsProcessed: events.length,
    eventTypes: statsByScope.get(`${NIL}|${NIL}`)?.size ?? 0,
    scopedBrokers: new Set(
      Array.from(statsByScope.keys()).map((k) => k.split("|")[0]).filter((b) => b !== NIL)
    ).size,
    scopedAgencies: new Set(
      Array.from(statsByScope.keys()).map((k) => k.split("|")[1]).filter((a) => a !== NIL)
    ).size,
  });
}

/**
 * GET /api/analytics/aggregate — convenience for manual trigger via browser
 */
export async function GET(req: NextRequest) {
  return POST(req);
}
