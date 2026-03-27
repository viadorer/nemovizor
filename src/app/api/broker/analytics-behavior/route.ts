import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

type Ev = { event_type: string; session_id: string; properties: Record<string, unknown>; url: string; referrer: string; device_type: string; created_at: string };

/**
 * GET /api/broker/analytics-behavior?broker_id=xxx  OR  ?agency_id=xxx
 * Returns behavioral analytics scoped to a broker's or agency's properties.
 */
export async function GET(req: NextRequest) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = getSupabase() as any;
  if (!client) return NextResponse.json({ error: "No DB" }, { status: 503 });

  const brokerId = req.nextUrl.searchParams.get("broker_id");
  const agencyId = req.nextUrl.searchParams.get("agency_id");
  if (!brokerId && !agencyId) return NextResponse.json({ error: "broker_id or agency_id required" }, { status: 400 });

  // ── Get property IDs owned by this broker / agency ──────────────────
  let propIds: string[] = [];
  if (brokerId) {
    const { data } = await client.from("properties").select("id").eq("broker_id", brokerId);
    propIds = (data || []).map((p: { id: string }) => p.id);
  } else if (agencyId) {
    // Get all broker IDs in this agency, then their properties
    const { data: brokers } = await client.from("brokers").select("id").eq("agency_id", agencyId);
    const brokerIds = (brokers || []).map((b: { id: string }) => b.id);
    if (brokerIds.length > 0) {
      const { data } = await client.from("properties").select("id").in("broker_id", brokerIds);
      propIds = (data || []).map((p: { id: string }) => p.id);
    }
  }

  // Also get slugs for URL matching
  let propSlugs: string[] = [];
  if (propIds.length > 0) {
    const { data: slugData } = await client.from("properties").select("slug").in("id", propIds);
    propSlugs = (slugData || []).map((p: { slug: string }) => p.slug);
  }

  const { error: tableCheck } = await client.from("analytics_events").select("id").limit(1);
  if (tableCheck) return NextResponse.json({ error: "analytics_events table not found" }, { status: 404 });

  const since7d = new Date(Date.now() - 7 * 86400_000).toISOString();
  const since14d = new Date(Date.now() - 14 * 86400_000).toISOString();

  // ── Fetch all events (14d) ──────────────────────────────────────────
  const { data: allEvents } = await client
    .from("analytics_events")
    .select("event_type, session_id, properties, url, referrer, device_type, created_at")
    .gte("created_at", since14d)
    .order("created_at", { ascending: true })
    .limit(50000);

  const rawEvents = (allEvents || []) as Ev[];

  // ── Filter events to only those related to this broker/agency's properties ──
  const propIdSet = new Set(propIds);
  const slugSet = new Set(propSlugs);

  function isRelevant(e: Ev): boolean {
    // Direct property events with property_id
    const pid = String(e.properties?.property_id || "");
    if (pid && propIdSet.has(pid)) return true;

    // URL-based match for page views on property detail pages
    if (e.url) {
      try {
        const path = new URL(e.url).pathname;
        if (path.startsWith("/nemovitost/")) {
          const slug = path.replace("/nemovitost/", "").replace(/\/$/, "");
          if (slugSet.has(slug)) return true;
        }
      } catch {}
    }

    // Slug match in event properties
    const slug = String(e.properties?.slug || "");
    if (slug && slugSet.has(slug)) return true;

    return false;
  }

  // For property-specific events, filter strictly
  // For global events (page_view without property context, filter_change, ai_search), skip
  const events = rawEvents.filter(isRelevant);
  const events7d = events.filter((e) => e.created_at >= since7d);

  // Also get sessions that interacted with these properties (for broader context)
  const relevantSessions = new Set(events7d.map((e) => e.session_id));

  // ── Basic KPIs ─────────────────────────────────────────────────────
  const uniqueSessions = relevantSessions.size;
  const propViews7d = events7d.filter((e) => e.event_type === "property_view").length;
  const impressions7d = events7d.filter((e) => e.event_type === "property_impression").length;
  const contactClicks = events7d.filter((e) =>
    ["phone_click", "email_click", "contact_broker_click"].includes(e.event_type)
  ).length;
  const favActions = events7d.filter((e) => e.event_type === "favorite_toggle").length;
  const mapClicks = events7d.filter((e) => e.event_type === "map_pin_click").length;

  // ── Avg scroll depth on property detail ─────────────────────────────
  const scrollEvents = events7d.filter((e) => e.event_type === "scroll_depth");
  const avgScrollDepth = scrollEvents.length
    ? Math.round(scrollEvents.reduce((sum, e) => sum + (Number(e.properties?.depth_pct) || 0), 0) / scrollEvents.length)
    : 0;

  // ── Avg time on page ────────────────────────────────────────────────
  const timeEvents = events7d.filter((e) => e.event_type === "time_on_page");
  const avgTimeOnPage = timeEvents.length
    ? Math.round(timeEvents.reduce((sum, e) => sum + (Number(e.properties?.seconds) || 0), 0) / timeEvents.length)
    : 0;

  // ── Event type breakdown ────────────────────────────────────────────
  const eventCounts: Record<string, number> = {};
  for (const e of events7d) eventCounts[e.event_type] = (eventCounts[e.event_type] || 0) + 1;
  const eventBreakdown = Object.entries(eventCounts)
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);

  // ── Device breakdown (from sessions that viewed these properties) ───
  const deviceCounts: Record<string, number> = {};
  for (const e of events7d) {
    if (e.event_type === "property_view") {
      const d = e.device_type || "unknown";
      deviceCounts[d] = (deviceCounts[d] || 0) + 1;
    }
  }

  // ── Top viewed properties ───────────────────────────────────────────
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

  // Enrich
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
        return { ...tp, title: String(real?.title || ""), price: Number(real?.price || 0), price_currency: String(real?.price_currency || ""), image_src: String(real?.image_src || ""), listing_type: String(real?.listing_type || ""), category: String(real?.category || ""), area: Number(real?.area || 0), rooms_label: String(real?.rooms_label || ""), slug: String(real?.slug || tp.slug), city: String(real?.city || tp.city) };
      });
    }
  }

  // ── Hourly activity ─────────────────────────────────────────────────
  const hourCounts = new Array(24).fill(0);
  for (const e of events7d) {
    const h = new Date(e.created_at).getHours();
    hourCounts[h]++;
  }

  // ── Conversion funnel ───────────────────────────────────────────────
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
    { step: "Imprese karty", sessions: funnelSessions.impressions.size },
    { step: "Detail nemovitosti", sessions: funnelSessions.views.size },
    { step: "Kontakt (tel/email/btn)", sessions: funnelSessions.contacts.size },
  ];

  // ── Daily property views (14 days) ──────────────────────────────────
  const dailyMap: Record<string, number> = {};
  for (const e of events.filter((e) => e.event_type === "property_view")) {
    const day = e.created_at.slice(0, 10);
    dailyMap[day] = (dailyMap[day] || 0) + 1;
  }
  const dailyViews = Object.entries(dailyMap).map(([date, views]) => ({ date, views })).sort((a, b) => a.date.localeCompare(b.date));

  // ── Contact requests from DB ────────────────────────────────────────
  let contactRequests = 0;
  let newContactRequests = 0;
  if (brokerId) {
    const { count: totalCR } = await client.from("contact_requests").select("id", { count: "exact", head: true }).eq("broker_id", brokerId);
    const { count: newCR } = await client.from("contact_requests").select("id", { count: "exact", head: true }).eq("broker_id", brokerId).eq("status", "new");
    contactRequests = totalCR ?? 0;
    newContactRequests = newCR ?? 0;
  } else if (agencyId) {
    // Sum across all agency brokers
    const { data: brokers } = await client.from("brokers").select("id").eq("agency_id", agencyId);
    const brokerIds = (brokers || []).map((b: { id: string }) => b.id);
    if (brokerIds.length > 0) {
      const { count: totalCR } = await client.from("contact_requests").select("id", { count: "exact", head: true }).in("broker_id", brokerIds);
      const { count: newCR } = await client.from("contact_requests").select("id", { count: "exact", head: true }).in("broker_id", brokerIds).eq("status", "new");
      contactRequests = totalCR ?? 0;
      newContactRequests = newCR ?? 0;
    }
  }

  return NextResponse.json({
    totalProperties: propIds.length,
    total7d: events7d.length,
    uniqueSessions,
    propViews7d,
    impressions7d,
    contactClicks,
    favActions,
    mapClicks,
    avgScrollDepth,
    avgTimeOnPage,
    eventBreakdown,
    deviceCounts,
    topProperties,
    hourCounts,
    funnel,
    dailyViews,
    contactRequests,
    newContactRequests,
  }, {
    headers: { "Cache-Control": "private, max-age=60" },
  });
}
