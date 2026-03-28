import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

type Ev = { event_type: string; session_id: string; properties: Record<string, unknown>; url: string; referrer: string; device_type: string; created_at: string };

/**
 * GET /api/admin/analytics-behavior
 * Returns comprehensive behavioral analytics.
 * Reads from pre-aggregated daily summary tables when available,
 * falls back to raw analytics_events when summaries are missing.
 * Response format is identical to the original raw-events implementation.
 */
export async function GET() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = getSupabase() as any;
  if (!client) return NextResponse.json({ error: "No DB" }, { status: 503 });

  const { error: tableCheck } = await client.from("analytics_events").select("id").limit(1);
  if (tableCheck) {
    return NextResponse.json({ error: "analytics_events table not found — run migration 024" }, { status: 404 });
  }

  const now = new Date();
  const since7d = new Date(now.getTime() - 7 * 86400_000).toISOString().slice(0, 10);
  const since14d = new Date(now.getTime() - 14 * 86400_000).toISOString().slice(0, 10);
  const today = now.toISOString().slice(0, 10);

  // ── Check if summary tables have data for the 7d window ──
  const { data: summaryCheck } = await client
    .from("analytics_daily_stats")
    .select("stat_date")
    .gte("stat_date", since7d)
    .lte("stat_date", today)
    .limit(1);

  const hasSummaries = summaryCheck && summaryCheck.length > 0;

  if (hasSummaries) {
    return buildFromSummaries(client, since7d, since14d, today);
  }

  // ── Fallback: compute from raw events (original logic) ──
  return buildFromRawEvents(client);
}

// ════════════════════════════════════════════════════════════════════════
// Summary-based path
// ════════════════════════════════════════════════════════════════════════
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function buildFromSummaries(client: any, since7d: string, since14d: string, today: string) {
  // ── 1. analytics_daily_stats (7d) ──
  const { data: statsRows } = await client
    .from("analytics_daily_stats")
    .select("*")
    .gte("stat_date", since7d)
    .lte("stat_date", today);

  const stats7d: Record<string, { event_count: number; unique_sessions: number; desktop: number; mobile: number; tablet: number }> = {};
  let totalEvents = 0;
  let totalUniqueSessions = 0;
  const sessionSet = new Set<string>(); // approximate via daily unique_sessions sum
  for (const row of statsRows || []) {
    if (!stats7d[row.event_type]) {
      stats7d[row.event_type] = { event_count: 0, unique_sessions: 0, desktop: 0, mobile: 0, tablet: 0 };
    }
    const s = stats7d[row.event_type];
    s.event_count += row.event_count;
    s.unique_sessions += row.unique_sessions;
    s.desktop += row.device_desktop;
    s.mobile += row.device_mobile;
    s.tablet += row.device_tablet;
    totalEvents += row.event_count;
  }

  // Approximate unique sessions across 7d from page_view unique sessions per day
  // This is an approximation — same session across days counted multiple times
  const pvStats = stats7d["page_view"];
  totalUniqueSessions = pvStats ? pvStats.unique_sessions : 0;
  // Better: sum all event types' sessions but take the page_view one as most representative
  // For truly unique sessions across days, we'd need raw data. This is acceptable for dashboards.

  const pageViews7d = stats7d["page_view"]?.event_count || 0;
  const propViews7d = stats7d["property_view"]?.event_count || 0;
  const contactClicks =
    (stats7d["phone_click"]?.event_count || 0) +
    (stats7d["email_click"]?.event_count || 0) +
    (stats7d["contact_broker_click"]?.event_count || 0);
  const favActions = stats7d["favorite_toggle"]?.event_count || 0;

  // Event breakdown
  const eventBreakdown = Object.entries(stats7d)
    .map(([type, s]) => ({ type, count: s.event_count }))
    .sort((a, b) => b.count - a.count);

  // Device counts (from page_view events)
  const deviceCounts: Record<string, number> = {};
  if (pvStats) {
    if (pvStats.desktop > 0) deviceCounts["desktop"] = pvStats.desktop;
    if (pvStats.mobile > 0) deviceCounts["mobile"] = pvStats.mobile;
    if (pvStats.tablet > 0) deviceCounts["tablet"] = pvStats.tablet;
    const otherDevices = pvStats.event_count - pvStats.desktop - pvStats.mobile - pvStats.tablet;
    if (otherDevices > 0) deviceCounts["unknown"] = otherDevices;
  }

  // ── 2. Funnel (7d) ──
  const { data: funnelRows } = await client
    .from("analytics_daily_funnel")
    .select("*")
    .gte("stat_date", since7d)
    .lte("stat_date", today);

  let sessionsTotal = 0;
  let sessionsImpression = 0;
  let sessionsDetail = 0;
  let sessionsContact = 0;
  let bounceTotal = 0;
  let scrollDepthSum = 0;
  let timeOnPageSum = 0;
  let funnelDays = 0;

  for (const row of funnelRows || []) {
    sessionsTotal += row.sessions_total;
    sessionsImpression += row.sessions_impression;
    sessionsDetail += row.sessions_detail;
    sessionsContact += row.sessions_contact;
    bounceTotal += row.bounce_count;
    scrollDepthSum += Number(row.avg_scroll_depth);
    timeOnPageSum += Number(row.avg_time_on_page);
    funnelDays++;
  }

  const bounceRate = sessionsTotal > 0 ? Math.round((bounceTotal / sessionsTotal) * 100) : 0;
  const avgScrollDepth = funnelDays > 0 ? Math.round(scrollDepthSum / funnelDays) : 0;
  const avgTimeOnPage = funnelDays > 0 ? Math.round(timeOnPageSum / funnelDays) : 0;

  const uniqueSessions = totalUniqueSessions || sessionsTotal;

  const funnel = [
    { step: "Zobrazení stránky", sessions: sessionsTotal },
    { step: "Imprese karty", sessions: sessionsImpression },
    { step: "Detail nemovitosti", sessions: sessionsDetail },
    { step: "Kontakt (tel/email/btn)", sessions: sessionsContact },
  ];

  // ── 3. Top pages (7d) ──
  const { data: pageRows } = await client
    .from("analytics_daily_top_pages")
    .select("page_path, view_count")
    .gte("stat_date", since7d)
    .lte("stat_date", today);

  const pageAgg: Record<string, number> = {};
  for (const row of pageRows || []) {
    pageAgg[row.page_path] = (pageAgg[row.page_path] || 0) + row.view_count;
  }
  const topPages = Object.entries(pageAgg)
    .map(([path, views]) => ({ path, views }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 15);

  // ── 4. Top properties (7d) + enrich ──
  const { data: propRows } = await client
    .from("analytics_daily_top_properties")
    .select("property_id, view_count, slug, city")
    .gte("stat_date", since7d)
    .lte("stat_date", today);

  const propAgg: Record<string, { count: number; slug: string; city: string }> = {};
  for (const row of propRows || []) {
    if (!propAgg[row.property_id]) propAgg[row.property_id] = { count: 0, slug: row.slug || "", city: row.city || "" };
    propAgg[row.property_id].count += row.view_count;
  }
  const topPropertiesRaw = Object.entries(propAgg)
    .map(([id, d]) => ({ id, ...d }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  let topProperties: { id: string; count: number; slug: string; city: string; title?: string; price?: number; price_currency?: string; image_src?: string; listing_type?: string; category?: string; area?: number; rooms_label?: string }[] = topPropertiesRaw;
  if (topPropertiesRaw.length > 0) {
    const ids = topPropertiesRaw.map((p) => p.id);
    const { data: propsData } = await client
      .from("properties")
      .select("id, slug, title, city, price, price_currency, image_src, listing_type, category, area, rooms_label")
      .in("id", ids);
    if (propsData && propsData.length > 0) {
      const propsMap = new Map((propsData as { id: string }[]).map((p) => [p.id, p]));
      topProperties = topPropertiesRaw.map((tp) => {
        const real = propsMap.get(tp.id) as Record<string, unknown> | undefined;
        return {
          ...tp,
          title: String(real?.title || ""),
          price: Number(real?.price || 0),
          price_currency: String(real?.price_currency || ""),
          image_src: String(real?.image_src || ""),
          listing_type: String(real?.listing_type || ""),
          category: String(real?.category || ""),
          area: Number(real?.area || 0),
          rooms_label: String(real?.rooms_label || ""),
          slug: String(real?.slug || tp.slug),
          city: String(real?.city || tp.city),
        };
      });
    }
  }

  // ── 5. Referrer sources (7d) ──
  const { data: refRows } = await client
    .from("analytics_daily_referrers")
    .select("source, visit_count")
    .gte("stat_date", since7d)
    .lte("stat_date", today);

  const refAgg: Record<string, number> = {};
  for (const row of refRows || []) {
    refAgg[row.source] = (refAgg[row.source] || 0) + row.visit_count;
  }
  const referrerSources = Object.entries(refAgg)
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // ── 6. Hourly activity (7d) ──
  const { data: hourlyRows } = await client
    .from("analytics_daily_hourly")
    .select("hour_of_day, event_count")
    .gte("stat_date", since7d)
    .lte("stat_date", today);

  const hourCounts = new Array(24).fill(0);
  for (const row of hourlyRows || []) {
    hourCounts[row.hour_of_day] += row.event_count;
  }

  // ── 7. Daily page views (14d) — from stats table ──
  const { data: dailyStatsRows } = await client
    .from("analytics_daily_stats")
    .select("stat_date, event_count")
    .eq("event_type", "page_view")
    .gte("stat_date", since14d)
    .lte("stat_date", today)
    .order("stat_date", { ascending: true });

  const dailyViews = (dailyStatsRows || []).map((row: { stat_date: string; event_count: number }) => ({
    date: row.stat_date,
    views: row.event_count,
  }));

  // ── 8. AI searches, UTM campaigns, filter usage — not in summary tables, fetch from raw if needed ──
  // These are lower-priority; fetch from raw events for 7d
  const since7dISO = new Date(Date.now() - 7 * 86400_000).toISOString();
  let topSearches: { query: string; count: number }[] = [];
  let utmCampaigns: { campaign: string; count: number }[] = [];
  let filterUsage: { filter: string; count: number }[] = [];

  // Fetch only the specific event types we need (much less data than all events)
  const { data: aiEvents } = await client
    .from("analytics_events")
    .select("properties")
    .eq("event_type", "ai_search")
    .gte("created_at", since7dISO)
    .limit(1000);

  if (aiEvents && aiEvents.length > 0) {
    const aiQueries: Record<string, number> = {};
    for (const e of aiEvents) {
      const q = String((e.properties as Record<string, unknown>)?.query || "");
      if (q) aiQueries[q] = (aiQueries[q] || 0) + 1;
    }
    topSearches = Object.entries(aiQueries).map(([query, count]) => ({ query, count })).sort((a, b) => b.count - a.count).slice(0, 10);
  }

  const { data: utmEvents } = await client
    .from("analytics_events")
    .select("properties")
    .eq("event_type", "page_view")
    .gte("created_at", since7dISO)
    .not("properties->utm_source", "is", null)
    .limit(1000);

  if (utmEvents && utmEvents.length > 0) {
    const utmCounts: Record<string, number> = {};
    for (const e of utmEvents) {
      const props = e.properties as Record<string, unknown>;
      const src = String(props?.utm_source || "");
      const med = String(props?.utm_medium || "");
      const camp = String(props?.utm_campaign || "");
      if (src || med || camp) {
        const key = [src, med, camp].filter(Boolean).join(" / ");
        utmCounts[key] = (utmCounts[key] || 0) + 1;
      }
    }
    utmCampaigns = Object.entries(utmCounts).map(([campaign, count]) => ({ campaign, count })).sort((a, b) => b.count - a.count).slice(0, 10);
  }

  const { data: filterEvents } = await client
    .from("analytics_events")
    .select("properties")
    .eq("event_type", "filter_change")
    .gte("created_at", since7dISO)
    .limit(1000);

  if (filterEvents && filterEvents.length > 0) {
    const filterCounts: Record<string, number> = {};
    for (const e of filterEvents) {
      const p = (e.properties || {}) as Record<string, unknown>;
      if (p.listing_type) filterCounts[`Typ: ${p.listing_type}`] = (filterCounts[`Typ: ${p.listing_type}`] || 0) + 1;
      if (p.categories) filterCounts[`Kat: ${p.categories}`] = (filterCounts[`Kat: ${p.categories}`] || 0) + 1;
      if (p.countries) filterCounts[`Země: ${p.countries}`] = (filterCounts[`Země: ${p.countries}`] || 0) + 1;
      if (Number(p.price_min) > 0 || Number(p.price_max) > 0) filterCounts["Cena (rozsah)"] = (filterCounts["Cena (rozsah)"] || 0) + 1;
      if (Number(p.area_min) > 0 || Number(p.area_max) > 0) filterCounts["Plocha (rozsah)"] = (filterCounts["Plocha (rozsah)"] || 0) + 1;
    }
    filterUsage = Object.entries(filterCounts).map(([filter, count]) => ({ filter, count })).sort((a, b) => b.count - a.count).slice(0, 15);
  }

  return NextResponse.json({
    total7d: totalEvents,
    uniqueSessions,
    pageViews7d,
    propViews7d,
    contactClicks,
    favActions,
    bounceRate,
    avgScrollDepth,
    avgTimeOnPage,
    eventBreakdown,
    deviceCounts,
    topPages,
    topProperties,
    topSearches,
    referrerSources,
    utmCampaigns,
    filterUsage,
    hourCounts,
    funnel,
    dailyViews,
  }, {
    headers: { "Cache-Control": "private, max-age=60" },
  });
}

// ════════════════════════════════════════════════════════════════════════
// Fallback: raw events path (original logic, kept for when summaries
// haven't been generated yet)
// ════════════════════════════════════════════════════════════════════════
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function buildFromRawEvents(client: any) {
  const since7d = new Date(Date.now() - 7 * 86400_000).toISOString();
  const since14d = new Date(Date.now() - 14 * 86400_000).toISOString();

  const events: Ev[] = [];
  let page = 0;
  const PAGE_SIZE = 1000;
  while (true) {
    const { data: batch } = await client
      .from("analytics_events")
      .select("event_type, session_id, properties, url, referrer, device_type, created_at")
      .gte("created_at", since14d)
      .order("created_at", { ascending: true })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    if (!batch || batch.length === 0) break;
    events.push(...(batch as Ev[]));
    if (batch.length < PAGE_SIZE) break;
    page++;
    if (page > 50) break;
  }
  const events7d = events.filter((e) => e.created_at >= since7d);

  const sessions7d = new Set(events7d.map((e) => e.session_id));
  const uniqueSessions = sessions7d.size;
  const pageViews7d = events7d.filter((e) => e.event_type === "page_view").length;
  const propViews7d = events7d.filter((e) => e.event_type === "property_view").length;
  const contactClicks = events7d.filter((e) =>
    ["phone_click", "email_click", "contact_broker_click"].includes(e.event_type)
  ).length;
  const favActions = events7d.filter((e) => e.event_type === "favorite_toggle").length;

  const sessionPageCounts: Record<string, number> = {};
  for (const e of events7d) {
    if (e.event_type === "page_view") {
      sessionPageCounts[e.session_id] = (sessionPageCounts[e.session_id] || 0) + 1;
    }
  }
  const totalSessions = Object.keys(sessionPageCounts).length || 1;
  const bounceSessions = Object.values(sessionPageCounts).filter((c) => c === 1).length;
  const bounceRate = Math.round((bounceSessions / totalSessions) * 100);

  const scrollEvents = events7d.filter((e) => e.event_type === "scroll_depth");
  const avgScrollDepth = scrollEvents.length
    ? Math.round(scrollEvents.reduce((sum, e) => sum + (Number(e.properties?.depth_pct) || 0), 0) / scrollEvents.length)
    : 0;

  const timeEvents = events7d.filter((e) => e.event_type === "time_on_page");
  const avgTimeOnPage = timeEvents.length
    ? Math.round(timeEvents.reduce((sum, e) => sum + (Number(e.properties?.seconds) || 0), 0) / timeEvents.length)
    : 0;

  const eventCounts: Record<string, number> = {};
  for (const e of events7d) eventCounts[e.event_type] = (eventCounts[e.event_type] || 0) + 1;
  const eventBreakdown = Object.entries(eventCounts)
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);

  const deviceCounts: Record<string, number> = {};
  for (const e of events7d.filter((e) => e.event_type === "page_view")) {
    const d = e.device_type || "unknown";
    deviceCounts[d] = (deviceCounts[d] || 0) + 1;
  }

  const pageCounts: Record<string, number> = {};
  for (const e of events7d.filter((e) => e.event_type === "page_view")) {
    try { const p = new URL(e.url).pathname; pageCounts[p] = (pageCounts[p] || 0) + 1; } catch {}
  }
  const topPages = Object.entries(pageCounts).map(([path, views]) => ({ path, views })).sort((a, b) => b.views - a.views).slice(0, 15);

  const propCounts: Record<string, { count: number; slug: string; city: string }> = {};
  for (const e of events7d.filter((e) => e.event_type === "property_view")) {
    const pid = String(e.properties?.property_id || "");
    if (!pid) continue;
    if (!propCounts[pid]) propCounts[pid] = { count: 0, slug: String(e.properties?.slug || ""), city: String(e.properties?.city || "") };
    propCounts[pid].count++;
  }
  const topPropertiesRaw = Object.entries(propCounts)
    .map(([id, d]) => ({ id, ...d }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  let topProperties: { id: string; count: number; slug: string; city: string; title?: string; price?: number; price_currency?: string; image_src?: string; listing_type?: string; category?: string; area?: number; rooms_label?: string }[] = topPropertiesRaw;
  if (topPropertiesRaw.length > 0) {
    const ids = topPropertiesRaw.map((p) => p.id);
    const { data: propsData } = await client
      .from("properties")
      .select("id, slug, title, city, price, price_currency, image_src, listing_type, category, area, rooms_label")
      .in("id", ids);
    if (propsData && propsData.length > 0) {
      const propsMap = new Map((propsData as { id: string }[]).map((p) => [p.id, p]));
      topProperties = topPropertiesRaw.map((tp) => {
        const real = propsMap.get(tp.id) as Record<string, unknown> | undefined;
        return {
          ...tp,
          title: String(real?.title || ""),
          price: Number(real?.price || 0),
          price_currency: String(real?.price_currency || ""),
          image_src: String(real?.image_src || ""),
          listing_type: String(real?.listing_type || ""),
          category: String(real?.category || ""),
          area: Number(real?.area || 0),
          rooms_label: String(real?.rooms_label || ""),
          slug: String(real?.slug || tp.slug),
          city: String(real?.city || tp.city),
        };
      });
    }
  }

  const aiQueries: Record<string, number> = {};
  for (const e of events7d.filter((e) => e.event_type === "ai_search")) {
    const q = String(e.properties?.query || "");
    if (q) aiQueries[q] = (aiQueries[q] || 0) + 1;
  }
  const topSearches = Object.entries(aiQueries).map(([query, count]) => ({ query, count })).sort((a, b) => b.count - a.count).slice(0, 10);

  const refCounts: Record<string, number> = {};
  for (const e of events7d.filter((e) => e.event_type === "page_view")) {
    let source = "direct";
    if (e.referrer) {
      try { source = new URL(e.referrer).hostname.replace("www.", ""); } catch { source = e.referrer.slice(0, 50); }
    }
    if (source.includes("nemovizor") || source.includes("localhost")) continue;
    refCounts[source] = (refCounts[source] || 0) + 1;
  }
  const referrerSources = Object.entries(refCounts).map(([source, count]) => ({ source, count })).sort((a, b) => b.count - a.count).slice(0, 10);

  const utmCounts: Record<string, number> = {};
  for (const e of events7d.filter((e) => e.event_type === "page_view")) {
    const src = String(e.properties?.utm_source || "");
    const med = String(e.properties?.utm_medium || "");
    const camp = String(e.properties?.utm_campaign || "");
    if (src || med || camp) {
      const key = [src, med, camp].filter(Boolean).join(" / ");
      utmCounts[key] = (utmCounts[key] || 0) + 1;
    }
  }
  const utmCampaigns = Object.entries(utmCounts).map(([campaign, count]) => ({ campaign, count })).sort((a, b) => b.count - a.count).slice(0, 10);

  const filterCounts: Record<string, number> = {};
  for (const e of events7d.filter((e) => e.event_type === "filter_change")) {
    const p = e.properties || {};
    if (p.listing_type) filterCounts[`Typ: ${p.listing_type}`] = (filterCounts[`Typ: ${p.listing_type}`] || 0) + 1;
    if (p.categories) filterCounts[`Kat: ${p.categories}`] = (filterCounts[`Kat: ${p.categories}`] || 0) + 1;
    if (p.countries) filterCounts[`Země: ${p.countries}`] = (filterCounts[`Země: ${p.countries}`] || 0) + 1;
    if (Number(p.price_min) > 0 || Number(p.price_max) > 0) filterCounts["Cena (rozsah)"] = (filterCounts["Cena (rozsah)"] || 0) + 1;
    if (Number(p.area_min) > 0 || Number(p.area_max) > 0) filterCounts["Plocha (rozsah)"] = (filterCounts["Plocha (rozsah)"] || 0) + 1;
  }
  const filterUsage = Object.entries(filterCounts).map(([filter, count]) => ({ filter, count })).sort((a, b) => b.count - a.count).slice(0, 15);

  const hourCounts = new Array(24).fill(0);
  for (const e of events7d.filter((e) => e.event_type === "page_view")) {
    const h = new Date(e.created_at).getHours();
    hourCounts[h]++;
  }

  const funnelSessions = {
    impressions: new Set<string>(),
    views: new Set<string>(),
    contacts: new Set<string>(),
  };
  for (const e of events7d) {
    if (e.event_type === "property_impression") funnelSessions.impressions.add(e.session_id);
    if (e.event_type === "property_view") funnelSessions.views.add(e.session_id);
    if (["phone_click", "email_click", "contact_broker_click"].includes(e.event_type)) funnelSessions.contacts.add(e.session_id);
  }
  const funnel = [
    { step: "Zobrazení stránky", sessions: totalSessions },
    { step: "Imprese karty", sessions: funnelSessions.impressions.size },
    { step: "Detail nemovitosti", sessions: funnelSessions.views.size },
    { step: "Kontakt (tel/email/btn)", sessions: funnelSessions.contacts.size },
  ];

  const dailyMap: Record<string, number> = {};
  for (const e of events.filter((e) => e.event_type === "page_view")) {
    const day = e.created_at.slice(0, 10);
    dailyMap[day] = (dailyMap[day] || 0) + 1;
  }
  const dailyViews = Object.entries(dailyMap).map(([date, views]) => ({ date, views })).sort((a, b) => a.date.localeCompare(b.date));

  return NextResponse.json({
    total7d: events7d.length,
    uniqueSessions,
    pageViews7d,
    propViews7d,
    contactClicks,
    favActions,
    bounceRate,
    avgScrollDepth,
    avgTimeOnPage,
    eventBreakdown,
    deviceCounts,
    topPages,
    topProperties,
    topSearches,
    referrerSources,
    utmCampaigns,
    filterUsage,
    hourCounts,
    funnel,
    dailyViews,
  }, {
    headers: { "Cache-Control": "private, max-age=60" },
  });
}
