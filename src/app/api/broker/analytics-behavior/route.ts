import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { apiError } from "@/lib/api/response";
import { parseQuery } from "@/lib/api/validate";
import { BrokerAnalyticsQuerySchema } from "@/lib/api/schemas/broker-analytics";
import {
  checkRateLimit,
  rateLimitHeaders,
  rateLimitResponse,
  TIER1_RATE_LIMITS,
} from "@/lib/api/rate-limit";
import { resolveAuthContext } from "@/lib/api/auth-context";
import { createAuditTap } from "@/lib/api/audit-log";

export const dynamic = "force-dynamic";

const NIL = "00000000-0000-0000-0000-000000000000";

type Ev = { event_type: string; session_id: string; properties: Record<string, unknown>; url: string; referrer: string; device_type: string; created_at: string };

/**
 * GET /api/broker/analytics-behavior?broker_id=xxx  OR  ?agency_id=xxx
 * Full contract: see OpenAPI at /api/openapi (BrokerAnalyticsQuery / BrokerAnalyticsResponse).
 */
export async function GET(req: NextRequest) {
  const startedAt = Date.now();
  const authCtx = await resolveAuthContext(req, TIER1_RATE_LIMITS["broker-analytics"]);
  const tap = createAuditTap({ endpoint: "/api/broker/analytics-behavior", method: "GET", authCtx, startedAt });

  const rl = await checkRateLimit(authCtx.rateLimitClientKey, authCtx.rateLimitConfig);
  if (!rl.ok) return tap(rateLimitResponse(rl));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = getSupabase() as any;
  if (!client) return tap(apiError("SERVICE_UNAVAILABLE", "No DB", 503));

  const parsed = parseQuery(req.nextUrl.searchParams, BrokerAnalyticsQuerySchema);
  if (!parsed.ok) return tap(parsed.response);
  const { broker_id: brokerId = null, agency_id: agencyId = null } = parsed.data as {
    broker_id?: string;
    agency_id?: string;
  };

  // ── Get property count ──
  let totalProperties = 0;
  if (brokerId) {
    const { count } = await client.from("properties").select("id", { count: "exact", head: true }).eq("broker_id", brokerId);
    totalProperties = count ?? 0;
  } else if (agencyId) {
    const { data: brokers } = await client.from("brokers").select("id").eq("agency_id", agencyId);
    const brokerIds = (brokers || []).map((b: { id: string }) => b.id);
    if (brokerIds.length > 0) {
      const { count } = await client.from("properties").select("id", { count: "exact", head: true }).in("broker_id", brokerIds);
      totalProperties = count ?? 0;
    }
  }

  // ── Scope filter for summary tables ──
  const scopeFilter = brokerId
    ? { broker_id: brokerId, agency_id: NIL }
    : { broker_id: NIL, agency_id: agencyId! };

  // Date range: last 7 days for KPIs, 14 days for daily chart
  const now = new Date();
  const date7dAgo = new Date(now.getTime() - 7 * 86400_000).toISOString().slice(0, 10);
  const date14dAgo = new Date(now.getTime() - 14 * 86400_000).toISOString().slice(0, 10);
  const today = now.toISOString().slice(0, 10);

  // ── Try summary tables first ──
  const { data: statsData } = await client
    .from("analytics_daily_stats")
    .select("*")
    .eq("broker_id", scopeFilter.broker_id)
    .eq("agency_id", scopeFilter.agency_id)
    .gte("stat_date", date7dAgo)
    .lte("stat_date", today);

  const hasSummaries = statsData && statsData.length > 0;

  if (hasSummaries) {
    return tap(await buildResponseFromSummaries(client, statsData, scopeFilter, date7dAgo, date14dAgo, today, totalProperties, brokerId, agencyId, rateLimitHeaders(rl)));
  }

  // ── Fallback: raw events (same as original implementation) ──
  return tap(await buildResponseFromRawEvents(client, brokerId, agencyId, totalProperties, rateLimitHeaders(rl)));
}

// ═══════════════════════════════════════════════════════════════════════
// Summary-based response
// ═══════════════════════════════════════════════════════════════════════
async function buildResponseFromSummaries(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  statsData: any[],
  scopeFilter: { broker_id: string; agency_id: string },
  date7dAgo: string,
  date14dAgo: string,
  today: string,
  totalProperties: number,
  brokerId: string | null,
  agencyId: string | null,
  extraHeaders: Record<string, string> = {},
) {
  // ── KPIs from stats ──
  const eventCounts: Record<string, number> = {};
  let uniqueSessions = 0;
  const deviceCounts: Record<string, number> = {};

  for (const row of statsData) {
    eventCounts[row.event_type] = (eventCounts[row.event_type] || 0) + row.event_count;
    uniqueSessions += row.unique_sessions || 0;
    if (row.event_type === "property_view") {
      deviceCounts["desktop"] = (deviceCounts["desktop"] || 0) + (row.device_desktop || 0);
      deviceCounts["mobile"] = (deviceCounts["mobile"] || 0) + (row.device_mobile || 0);
      deviceCounts["tablet"] = (deviceCounts["tablet"] || 0) + (row.device_tablet || 0);
    }
  }

  // Deduplicate sessions across days (rough — sum of daily unique, but good enough for summary)
  // For more accuracy we'd need a distinct session tracking, but this is pre-aggregated data
  const propViews7d = eventCounts["property_view"] || 0;
  const impressions7d = eventCounts["property_impression"] || 0;
  const contactClicks = (eventCounts["phone_click"] || 0) + (eventCounts["email_click"] || 0) + (eventCounts["contact_broker_click"] || 0);
  const favActions = eventCounts["favorite_toggle"] || 0;
  const mapClicks = eventCounts["map_pin_click"] || 0;
  const total7d = Object.values(eventCounts).reduce((a, b) => a + b, 0);

  const eventBreakdown = Object.entries(eventCounts)
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);

  // ── Funnel data (last 7 days) ──
  const { data: funnelData } = await client
    .from("analytics_daily_funnel")
    .select("*")
    .eq("broker_id", scopeFilter.broker_id)
    .eq("agency_id", scopeFilter.agency_id)
    .gte("stat_date", date7dAgo)
    .lte("stat_date", today);

  let avgScrollDepth = 0;
  let avgTimeOnPage = 0;
  let sessionsImpression = 0;
  let sessionsDetail = 0;
  let sessionsContact = 0;

  if (funnelData && funnelData.length > 0) {
    let scrollSum = 0, scrollCount = 0, timeSum = 0, timeCount = 0;
    for (const row of funnelData) {
      sessionsImpression += row.sessions_impression || 0;
      sessionsDetail += row.sessions_detail || 0;
      sessionsContact += row.sessions_contact || 0;
      if (row.avg_scroll_depth > 0) { scrollSum += Number(row.avg_scroll_depth); scrollCount++; }
      if (row.avg_time_on_page > 0) { timeSum += Number(row.avg_time_on_page); timeCount++; }
    }
    avgScrollDepth = scrollCount ? Math.round(scrollSum / scrollCount) : 0;
    avgTimeOnPage = timeCount ? Math.round(timeSum / timeCount) : 0;
  }

  const funnel = [
    { step: "Imprese karty", sessions: sessionsImpression },
    { step: "Detail nemovitosti", sessions: sessionsDetail },
    { step: "Kontakt (tel/email/btn)", sessions: sessionsContact },
  ];

  // ── Top properties (last 7 days) ──
  const { data: topPropsData } = await client
    .from("analytics_daily_top_properties")
    .select("property_id, view_count, slug, city")
    .eq("broker_id", scopeFilter.broker_id)
    .eq("agency_id", scopeFilter.agency_id)
    .gte("stat_date", date7dAgo)
    .lte("stat_date", today);

  // Aggregate across days
  const propMap = new Map<string, { count: number; slug: string; city: string }>();
  if (topPropsData) {
    for (const row of topPropsData) {
      const existing = propMap.get(row.property_id);
      if (existing) {
        existing.count += row.view_count;
      } else {
        propMap.set(row.property_id, { count: row.view_count, slug: row.slug || "", city: row.city || "" });
      }
    }
  }

  const topPropertiesRaw = Array.from(propMap.entries())
    .map(([id, d]) => ({ id, ...d }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Enrich top properties
  let topProperties: Record<string, unknown>[] = topPropertiesRaw;
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
          id: tp.id,
          count: tp.count,
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

  // ── Hourly activity (last 7 days) ──
  const { data: hourlyData } = await client
    .from("analytics_daily_hourly")
    .select("hour_of_day, event_count")
    .eq("broker_id", scopeFilter.broker_id)
    .eq("agency_id", scopeFilter.agency_id)
    .gte("stat_date", date7dAgo)
    .lte("stat_date", today);

  const hourCounts = new Array(24).fill(0);
  if (hourlyData) {
    for (const row of hourlyData) {
      hourCounts[row.hour_of_day] += row.event_count;
    }
  }

  // ── Daily property views (14 days) ──
  const { data: dailyPropsData } = await client
    .from("analytics_daily_top_properties")
    .select("stat_date, view_count")
    .eq("broker_id", scopeFilter.broker_id)
    .eq("agency_id", scopeFilter.agency_id)
    .gte("stat_date", date14dAgo)
    .lte("stat_date", today);

  const dailyMap: Record<string, number> = {};
  if (dailyPropsData) {
    for (const row of dailyPropsData) {
      const day = typeof row.stat_date === "string" ? row.stat_date : String(row.stat_date);
      dailyMap[day] = (dailyMap[day] || 0) + row.view_count;
    }
  }
  const dailyViews = Object.entries(dailyMap).map(([date, views]) => ({ date, views })).sort((a, b) => a.date.localeCompare(b.date));

  // ── Contact requests from DB ──
  let contactRequests = 0;
  let newContactRequests = 0;
  if (brokerId) {
    const { count: totalCR } = await client.from("contact_requests").select("id", { count: "exact", head: true }).eq("broker_id", brokerId);
    const { count: newCR } = await client.from("contact_requests").select("id", { count: "exact", head: true }).eq("broker_id", brokerId).eq("status", "new");
    contactRequests = totalCR ?? 0;
    newContactRequests = newCR ?? 0;
  } else if (agencyId) {
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
    totalProperties,
    total7d,
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
    headers: { "Cache-Control": "private, max-age=60", ...extraHeaders },
  });
}

// ═══════════════════════════════════════════════════════════════════════
// Fallback: raw events (original implementation)
// ═══════════════════════════════════════════════════════════════════════
async function buildResponseFromRawEvents(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
  brokerId: string | null,
  agencyId: string | null,
  totalProperties: number,
  extraHeaders: Record<string, string> = {},
) {
  // ── Get property IDs ──
  let propIds: string[] = [];
  if (brokerId) {
    let page = 0;
    const PAGE_SIZE = 1000;
    while (true) {
      const { data } = await client.from("properties").select("id").eq("broker_id", brokerId).range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (!data || data.length === 0) break;
      propIds.push(...data.map((p: { id: string }) => p.id));
      if (data.length < PAGE_SIZE) break;
      page++;
    }
  } else if (agencyId) {
    const { data: brokers } = await client.from("brokers").select("id").eq("agency_id", agencyId);
    const brokerIds = (brokers || []).map((b: { id: string }) => b.id);
    if (brokerIds.length > 0) {
      let page = 0;
      const PAGE_SIZE = 1000;
      while (true) {
        const { data } = await client.from("properties").select("id").in("broker_id", brokerIds).range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
        if (!data || data.length === 0) break;
        propIds.push(...data.map((p: { id: string }) => p.id));
        if (data.length < PAGE_SIZE) break;
        page++;
      }
    }
  }

  // Also get slugs
  let propSlugs: string[] = [];
  if (propIds.length > 0) {
    for (let i = 0; i < propIds.length; i += 1000) {
      const batch = propIds.slice(i, i + 1000);
      const { data: slugData } = await client.from("properties").select("slug").in("id", batch);
      if (slugData) propSlugs.push(...slugData.map((p: { slug: string }) => p.slug));
    }
  }

  const since7d = new Date(Date.now() - 7 * 86400_000).toISOString();
  const since14d = new Date(Date.now() - 14 * 86400_000).toISOString();

  const { data: allEvents } = await client
    .from("analytics_events")
    .select("event_type, session_id, properties, url, referrer, device_type, created_at")
    .gte("created_at", since14d)
    .order("created_at", { ascending: true })
    .limit(50000);

  const rawEvents = (allEvents || []) as Ev[];
  const propIdSet = new Set(propIds);
  const slugSet = new Set(propSlugs);

  function isRelevant(e: Ev): boolean {
    const pid = String(e.properties?.property_id || "");
    if (pid && propIdSet.has(pid)) return true;
    if (e.url) {
      try {
        const path = new URL(e.url).pathname;
        if (path.startsWith("/nemovitost/")) {
          const slug = path.replace("/nemovitost/", "").replace(/\/$/, "");
          if (slugSet.has(slug)) return true;
        }
      } catch { /* skip */ }
    }
    const slug = String(e.properties?.slug || "");
    if (slug && slugSet.has(slug)) return true;
    return false;
  }

  const events = rawEvents.filter(isRelevant);
  const events7d = events.filter((e) => e.created_at >= since7d);
  const relevantSessions = new Set(events7d.map((e) => e.session_id));

  const uniqueSessions = relevantSessions.size;
  const propViews7d = events7d.filter((e) => e.event_type === "property_view").length;
  const impressions7d = events7d.filter((e) => e.event_type === "property_impression").length;
  const contactClicks = events7d.filter((e) => ["phone_click", "email_click", "contact_broker_click"].includes(e.event_type)).length;
  const favActions = events7d.filter((e) => e.event_type === "favorite_toggle").length;
  const mapClicks = events7d.filter((e) => e.event_type === "map_pin_click").length;

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
  for (const e of events7d) {
    if (e.event_type === "property_view") {
      const d = e.device_type || "unknown";
      deviceCounts[d] = (deviceCounts[d] || 0) + 1;
    }
  }

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

  let topProperties: Record<string, unknown>[] = topPropertiesRaw;
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

  const hourCounts = new Array(24).fill(0);
  for (const e of events7d) {
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
    { step: "Imprese karty", sessions: funnelSessions.impressions.size },
    { step: "Detail nemovitosti", sessions: funnelSessions.views.size },
    { step: "Kontakt (tel/email/btn)", sessions: funnelSessions.contacts.size },
  ];

  const dailyMap: Record<string, number> = {};
  for (const e of events.filter((e) => e.event_type === "property_view")) {
    const day = e.created_at.slice(0, 10);
    dailyMap[day] = (dailyMap[day] || 0) + 1;
  }
  const dailyViews = Object.entries(dailyMap).map(([date, views]) => ({ date, views })).sort((a, b) => a.date.localeCompare(b.date));

  let contactRequests = 0;
  let newContactRequests = 0;
  if (brokerId) {
    const { count: totalCR } = await client.from("contact_requests").select("id", { count: "exact", head: true }).eq("broker_id", brokerId);
    const { count: newCR } = await client.from("contact_requests").select("id", { count: "exact", head: true }).eq("broker_id", brokerId).eq("status", "new");
    contactRequests = totalCR ?? 0;
    newContactRequests = newCR ?? 0;
  } else if (agencyId) {
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
    totalProperties,
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
    headers: { "Cache-Control": "private, max-age=60", ...extraHeaders },
  });
}
