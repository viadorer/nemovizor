import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

type Ev = { event_type: string; session_id: string; properties: Record<string, unknown>; url: string; referrer: string; device_type: string; created_at: string };

/**
 * GET /api/admin/analytics-behavior
 * Returns comprehensive behavioral analytics from analytics_events table.
 */
export async function GET() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = getSupabase() as any;
  if (!client) return NextResponse.json({ error: "No DB" }, { status: 503 });

  const { error: tableCheck } = await client.from("analytics_events").select("id").limit(1);
  if (tableCheck) {
    return NextResponse.json({ error: "analytics_events table not found — run migration 024" }, { status: 404 });
  }

  const since7d = new Date(Date.now() - 7 * 86400_000).toISOString();
  const since14d = new Date(Date.now() - 14 * 86400_000).toISOString();

  // ── Fetch all events (7d) in one go for in-memory aggregation ──────────
  const { data: allEvents } = await client
    .from("analytics_events")
    .select("event_type, session_id, properties, url, referrer, device_type, created_at")
    .gte("created_at", since14d)
    .order("created_at", { ascending: true })
    .limit(50000);

  const events = (allEvents || []) as Ev[];
  const events7d = events.filter((e) => e.created_at >= since7d);

  // ── Basic KPIs ─────────────────────────────────────────────────────────
  const sessions7d = new Set(events7d.map((e) => e.session_id));
  const uniqueSessions = sessions7d.size;
  const pageViews7d = events7d.filter((e) => e.event_type === "page_view").length;
  const propViews7d = events7d.filter((e) => e.event_type === "property_view").length;
  const contactClicks = events7d.filter((e) =>
    ["phone_click", "email_click", "contact_broker_click"].includes(e.event_type)
  ).length;
  const favActions = events7d.filter((e) => e.event_type === "favorite_toggle").length;

  // ── Bounce rate (sessions with only 1 page view) ──────────────────────
  const sessionPageCounts: Record<string, number> = {};
  for (const e of events7d) {
    if (e.event_type === "page_view") {
      sessionPageCounts[e.session_id] = (sessionPageCounts[e.session_id] || 0) + 1;
    }
  }
  const totalSessions = Object.keys(sessionPageCounts).length || 1;
  const bounceSessions = Object.values(sessionPageCounts).filter((c) => c === 1).length;
  const bounceRate = Math.round((bounceSessions / totalSessions) * 100);

  // ── Avg scroll depth ──────────────────────────────────────────────────
  const scrollEvents = events7d.filter((e) => e.event_type === "scroll_depth");
  const avgScrollDepth = scrollEvents.length
    ? Math.round(scrollEvents.reduce((sum, e) => sum + (Number(e.properties?.depth_pct) || 0), 0) / scrollEvents.length)
    : 0;

  // ── Avg time on page ──────────────────────────────────────────────────
  const timeEvents = events7d.filter((e) => e.event_type === "time_on_page");
  const avgTimeOnPage = timeEvents.length
    ? Math.round(timeEvents.reduce((sum, e) => sum + (Number(e.properties?.seconds) || 0), 0) / timeEvents.length)
    : 0;

  // ── Event type breakdown ──────────────────────────────────────────────
  const eventCounts: Record<string, number> = {};
  for (const e of events7d) eventCounts[e.event_type] = (eventCounts[e.event_type] || 0) + 1;
  const eventBreakdown = Object.entries(eventCounts)
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);

  // ── Device breakdown ──────────────────────────────────────────────────
  const deviceCounts: Record<string, number> = {};
  for (const e of events7d.filter((e) => e.event_type === "page_view")) {
    const d = e.device_type || "unknown";
    deviceCounts[d] = (deviceCounts[d] || 0) + 1;
  }

  // ── Top pages ─────────────────────────────────────────────────────────
  const pageCounts: Record<string, number> = {};
  for (const e of events7d.filter((e) => e.event_type === "page_view")) {
    try { const p = new URL(e.url).pathname; pageCounts[p] = (pageCounts[p] || 0) + 1; } catch {}
  }
  const topPages = Object.entries(pageCounts).map(([path, views]) => ({ path, views })).sort((a, b) => b.views - a.views).slice(0, 15);

  // ── Top viewed properties ─────────────────────────────────────────────
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

  // Enrich top properties with real data from properties table
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

  // ── Top AI searches ───────────────────────────────────────────────────
  const aiQueries: Record<string, number> = {};
  for (const e of events7d.filter((e) => e.event_type === "ai_search")) {
    const q = String(e.properties?.query || "");
    if (q) aiQueries[q] = (aiQueries[q] || 0) + 1;
  }
  const topSearches = Object.entries(aiQueries).map(([query, count]) => ({ query, count })).sort((a, b) => b.count - a.count).slice(0, 10);

  // ── Referrer sources ──────────────────────────────────────────────────
  const refCounts: Record<string, number> = {};
  for (const e of events7d.filter((e) => e.event_type === "page_view")) {
    let source = "direct";
    if (e.referrer) {
      try { source = new URL(e.referrer).hostname.replace("www.", ""); } catch { source = e.referrer.slice(0, 50); }
    }
    // Skip self-referrals
    if (source.includes("nemovizor") || source.includes("localhost")) continue;
    refCounts[source] = (refCounts[source] || 0) + 1;
  }
  const referrerSources = Object.entries(refCounts).map(([source, count]) => ({ source, count })).sort((a, b) => b.count - a.count).slice(0, 10);

  // ── UTM campaigns ─────────────────────────────────────────────────────
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

  // ── Filter usage ──────────────────────────────────────────────────────
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

  // ── Hourly activity (heatmap data — 0..23) ────────────────────────────
  const hourCounts = new Array(24).fill(0);
  for (const e of events7d.filter((e) => e.event_type === "page_view")) {
    const h = new Date(e.created_at).getHours();
    hourCounts[h]++;
  }

  // ── Conversion funnel ─────────────────────────────────────────────────
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

  // ── Daily page views (14 days) ────────────────────────────────────────
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
