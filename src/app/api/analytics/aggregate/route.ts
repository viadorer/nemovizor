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

/**
 * POST /api/analytics/aggregate
 * Aggregates raw analytics_events for a given date into summary tables.
 * Body: { date?: "YYYY-MM-DD" }  — defaults to yesterday.
 * Auth: CRON_SECRET header or admin session.
 * Idempotent: uses UPSERT so re-running for the same date is safe.
 */
export async function POST(req: NextRequest) {
  // ── Auth: check CRON_SECRET or skip in dev ──
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

  // ══════════════════════════════════════════════════════════════════════
  // 1. analytics_daily_stats — event counts by type
  // ══════════════════════════════════════════════════════════════════════
  const statsByType: Record<string, { count: number; sessions: Set<string>; desktop: number; mobile: number; tablet: number }> = {};
  for (const e of events) {
    if (!statsByType[e.event_type]) {
      statsByType[e.event_type] = { count: 0, sessions: new Set(), desktop: 0, mobile: 0, tablet: 0 };
    }
    const s = statsByType[e.event_type];
    s.count++;
    s.sessions.add(e.session_id);
    const dt = (e.device_type || "").toLowerCase();
    if (dt === "desktop") s.desktop++;
    else if (dt === "mobile") s.mobile++;
    else if (dt === "tablet") s.tablet++;
  }

  const statsRows = Object.entries(statsByType).map(([event_type, s]) => ({
    stat_date: targetDate,
    event_type,
    event_count: s.count,
    unique_sessions: s.sessions.size,
    device_desktop: s.desktop,
    device_mobile: s.mobile,
    device_tablet: s.tablet,
    updated_at: new Date().toISOString(),
  }));

  await client.from("analytics_daily_stats").upsert(statsRows, {
    onConflict: "stat_date,event_type",
  });

  // ══════════════════════════════════════════════════════════════════════
  // 2. analytics_daily_top_pages
  // ══════════════════════════════════════════════════════════════════════
  const pageCounts: Record<string, number> = {};
  for (const e of events.filter((e) => e.event_type === "page_view")) {
    try {
      const p = new URL(e.url).pathname;
      pageCounts[p] = (pageCounts[p] || 0) + 1;
    } catch { /* skip bad URLs */ }
  }
  const pageRows = Object.entries(pageCounts).map(([page_path, view_count]) => ({
    stat_date: targetDate,
    page_path,
    view_count,
  }));
  if (pageRows.length > 0) {
    await client.from("analytics_daily_top_pages").upsert(pageRows, {
      onConflict: "stat_date,page_path",
    });
  }

  // ══════════════════════════════════════════════════════════════════════
  // 3. analytics_daily_top_properties
  // ══════════════════════════════════════════════════════════════════════
  const propCounts: Record<string, { count: number; slug: string; city: string }> = {};
  for (const e of events.filter((e) => e.event_type === "property_view")) {
    const pid = String(e.properties?.property_id || "");
    if (!pid) continue;
    if (!propCounts[pid]) propCounts[pid] = { count: 0, slug: String(e.properties?.slug || ""), city: String(e.properties?.city || "") };
    propCounts[pid].count++;
  }
  const propRows = Object.entries(propCounts).map(([property_id, d]) => ({
    stat_date: targetDate,
    property_id,
    view_count: d.count,
    slug: d.slug,
    city: d.city,
  }));
  if (propRows.length > 0) {
    await client.from("analytics_daily_top_properties").upsert(propRows, {
      onConflict: "stat_date,property_id",
    });
  }

  // ══════════════════════════════════════════════════════════════════════
  // 4. analytics_daily_funnel
  // ══════════════════════════════════════════════════════════════════════
  const sessionPageCounts: Record<string, number> = {};
  for (const e of events) {
    if (e.event_type === "page_view") {
      sessionPageCounts[e.session_id] = (sessionPageCounts[e.session_id] || 0) + 1;
    }
  }
  const totalSessions = Object.keys(sessionPageCounts).length;
  const bounceCount = Object.values(sessionPageCounts).filter((c) => c === 1).length;

  const funnelSessions = {
    impressions: new Set<string>(),
    details: new Set<string>(),
    contacts: new Set<string>(),
  };
  for (const e of events) {
    if (e.event_type === "property_impression") funnelSessions.impressions.add(e.session_id);
    if (e.event_type === "property_view") funnelSessions.details.add(e.session_id);
    if (["phone_click", "email_click", "contact_broker_click"].includes(e.event_type)) funnelSessions.contacts.add(e.session_id);
  }

  const scrollEvents = events.filter((e) => e.event_type === "scroll_depth");
  const avgScrollDepth = scrollEvents.length
    ? scrollEvents.reduce((sum, e) => sum + (Number(e.properties?.depth_pct) || 0), 0) / scrollEvents.length
    : 0;

  const timeEvents = events.filter((e) => e.event_type === "time_on_page");
  const avgTimeOnPage = timeEvents.length
    ? timeEvents.reduce((sum, e) => sum + (Number(e.properties?.seconds) || 0), 0) / timeEvents.length
    : 0;

  await client.from("analytics_daily_funnel").upsert(
    [
      {
        stat_date: targetDate,
        sessions_total: totalSessions,
        sessions_impression: funnelSessions.impressions.size,
        sessions_detail: funnelSessions.details.size,
        sessions_contact: funnelSessions.contacts.size,
        bounce_count: bounceCount,
        avg_scroll_depth: Math.round(avgScrollDepth * 100) / 100,
        avg_time_on_page: Math.round(avgTimeOnPage * 100) / 100,
        updated_at: new Date().toISOString(),
      },
    ],
    { onConflict: "stat_date" }
  );

  // ══════════════════════════════════════════════════════════════════════
  // 5. analytics_daily_referrers
  // ══════════════════════════════════════════════════════════════════════
  const refCounts: Record<string, number> = {};
  for (const e of events.filter((e) => e.event_type === "page_view")) {
    let source = "direct";
    if (e.referrer) {
      try {
        source = new URL(e.referrer).hostname.replace("www.", "");
      } catch {
        source = e.referrer.slice(0, 50);
      }
    }
    if (source.includes("nemovizor") || source.includes("localhost")) continue;
    refCounts[source] = (refCounts[source] || 0) + 1;
  }
  const refRows = Object.entries(refCounts).map(([source, visit_count]) => ({
    stat_date: targetDate,
    source,
    visit_count,
  }));
  if (refRows.length > 0) {
    await client.from("analytics_daily_referrers").upsert(refRows, {
      onConflict: "stat_date,source",
    });
  }

  // ══════════════════════════════════════════════════════════════════════
  // 6. analytics_daily_hourly
  // ══════════════════════════════════════════════════════════════════════
  const hourCounts: Record<number, number> = {};
  for (const e of events.filter((e) => e.event_type === "page_view")) {
    const h = new Date(e.created_at).getUTCHours();
    hourCounts[h] = (hourCounts[h] || 0) + 1;
  }
  const hourRows = Object.entries(hourCounts).map(([hour, count]) => ({
    stat_date: targetDate,
    hour_of_day: Number(hour),
    event_count: count,
  }));
  if (hourRows.length > 0) {
    await client.from("analytics_daily_hourly").upsert(hourRows, {
      onConflict: "stat_date,hour_of_day",
    });
  }

  return NextResponse.json({
    ok: true,
    date: targetDate,
    eventsProcessed: events.length,
    eventTypes: Object.keys(statsByType).length,
  });
}

/**
 * GET /api/analytics/aggregate — convenience for manual trigger via browser
 */
export async function GET(req: NextRequest) {
  return POST(req);
}
