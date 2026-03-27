import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

/**
 * GET /api/admin/analytics-behavior
 * Returns behavioral analytics stats from analytics_events table.
 * Admin-only (checked via Supabase RLS — service role bypasses it server-side).
 */
export async function GET() {
  const client = getSupabase();
  if (!client) return NextResponse.json({ error: "No DB" }, { status: 503 });

  // Check if analytics_events table exists
  const { error: tableCheck } = await client
    .from("analytics_events")
    .select("id")
    .limit(1);

  if (tableCheck) {
    return NextResponse.json({ error: "analytics_events table not found — run migration 024" }, { status: 404 });
  }

  // ── Total events last 7 days ──────────────────────────────────────────────
  const { count: total7d } = await client
    .from("analytics_events")
    .select("*", { count: "exact", head: true })
    .gte("created_at", new Date(Date.now() - 7 * 86400_000).toISOString());

  // ── Unique sessions last 7 days ───────────────────────────────────────────
  const { data: sessionsData } = await client
    .from("analytics_events")
    .select("session_id")
    .gte("created_at", new Date(Date.now() - 7 * 86400_000).toISOString());
  const uniqueSessions = new Set((sessionsData || []).map((r: { session_id: string }) => r.session_id)).size;

  // ── Page views last 7 days ────────────────────────────────────────────────
  const { count: pageViews7d } = await client
    .from("analytics_events")
    .select("*", { count: "exact", head: true })
    .eq("event_type", "page_view")
    .gte("created_at", new Date(Date.now() - 7 * 86400_000).toISOString());

  // ── Property views last 7 days ────────────────────────────────────────────
  const { count: propViews7d } = await client
    .from("analytics_events")
    .select("*", { count: "exact", head: true })
    .eq("event_type", "property_view")
    .gte("created_at", new Date(Date.now() - 7 * 86400_000).toISOString());

  // ── Event type breakdown (last 7 days) ───────────────────────────────────
  const { data: eventRows } = await client
    .from("analytics_events")
    .select("event_type")
    .gte("created_at", new Date(Date.now() - 7 * 86400_000).toISOString());

  const eventCounts: Record<string, number> = {};
  for (const row of (eventRows || []) as { event_type: string }[]) {
    eventCounts[row.event_type] = (eventCounts[row.event_type] || 0) + 1;
  }
  const eventBreakdown = Object.entries(eventCounts)
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);

  // ── Device breakdown (last 7 days) ───────────────────────────────────────
  const { data: deviceRows } = await client
    .from("analytics_events")
    .select("device_type")
    .eq("event_type", "page_view")
    .gte("created_at", new Date(Date.now() - 7 * 86400_000).toISOString());

  const deviceCounts: Record<string, number> = {};
  for (const row of (deviceRows || []) as { device_type: string }[]) {
    const d = row.device_type || "unknown";
    deviceCounts[d] = (deviceCounts[d] || 0) + 1;
  }

  // ── Top pages (last 7 days) ───────────────────────────────────────────────
  const { data: pageRows } = await client
    .from("analytics_events")
    .select("url")
    .eq("event_type", "page_view")
    .gte("created_at", new Date(Date.now() - 7 * 86400_000).toISOString());

  const pageCounts: Record<string, number> = {};
  for (const row of (pageRows || []) as { url: string }[]) {
    try {
      const path = new URL(row.url).pathname;
      pageCounts[path] = (pageCounts[path] || 0) + 1;
    } catch { /* ignore malformed */ }
  }
  const topPages = Object.entries(pageCounts)
    .map(([path, views]) => ({ path, views }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 10);

  // ── Top AI searches (last 7 days) ─────────────────────────────────────────
  const { data: aiRows } = await client
    .from("analytics_events")
    .select("properties")
    .eq("event_type", "ai_search")
    .gte("created_at", new Date(Date.now() - 7 * 86400_000).toISOString());

  const aiQueries: Record<string, number> = {};
  for (const row of (aiRows || []) as { properties: Record<string, string> }[]) {
    const q = row.properties?.query;
    if (q) aiQueries[q] = (aiQueries[q] || 0) + 1;
  }
  const topSearches = Object.entries(aiQueries)
    .map(([query, count]) => ({ query, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // ── Daily page views (last 14 days) ──────────────────────────────────────
  const { data: dailyRows } = await client
    .from("analytics_events")
    .select("created_at")
    .eq("event_type", "page_view")
    .gte("created_at", new Date(Date.now() - 14 * 86400_000).toISOString())
    .order("created_at", { ascending: true });

  const dailyMap: Record<string, number> = {};
  for (const row of (dailyRows || []) as { created_at: string }[]) {
    const day = row.created_at.slice(0, 10);
    dailyMap[day] = (dailyMap[day] || 0) + 1;
  }
  const dailyViews = Object.entries(dailyMap)
    .map(([date, views]) => ({ date, views }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return NextResponse.json({
    total7d: total7d ?? 0,
    uniqueSessions,
    pageViews7d: pageViews7d ?? 0,
    propViews7d: propViews7d ?? 0,
    eventBreakdown,
    deviceCounts,
    topPages,
    topSearches,
    dailyViews,
  }, {
    headers: { "Cache-Control": "private, max-age=60" },
  });
}
