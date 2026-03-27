"use client";

import { useEffect, useState } from "react";
import { useT } from "@/i18n/provider";

type Stats = {
  properties: number;
  activeProperties: number;
  brokers: number;
  agencies: number;
  users: number;
  favorites: number;
  savedSearches: number;
  projects: number;
};

type BehaviorStats = {
  total7d: number;
  uniqueSessions: number;
  pageViews7d: number;
  propViews7d: number;
  eventBreakdown: { type: string; count: number }[];
  deviceCounts: Record<string, number>;
  topPages: { path: string; views: number }[];
  topSearches: { query: string; count: number }[];
  dailyViews: { date: string; views: number }[];
};

const EVENT_LABELS: Record<string, string> = {
  page_view: "Zobrazení stránky",
  property_view: "Detail nemovitosti",
  property_impression: "Imprese karty",
  scroll_depth: "Scroll hloubka",
  time_on_page: "Čas na stránce",
  filter_change: "Změna filtru",
  ai_search: "AI vyhledávání",
  map_pin_click: "Klik na mapě",
  favorite_toggle: "Oblíbené",
  phone_click: "Klik na telefon",
  email_click: "Klik na email",
  contact_broker_click: "Kontaktovat makléře",
};

export default function AdminAnalyticsPage() {
  const t = useT();
  const [stats, setStats] = useState<Stats | null>(null);
  const [behavior, setBehavior] = useState<BehaviorStats | null>(null);
  const [behaviorError, setBehaviorError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [behaviorLoading, setBehaviorLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/analytics")
      .then((r) => r.json())
      .then(setStats)
      .finally(() => setLoading(false));

    fetch("/api/admin/analytics-behavior")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setBehaviorError(data.error);
        else setBehavior(data);
      })
      .catch(() => setBehaviorError("Chyba načítání"))
      .finally(() => setBehaviorLoading(false));
  }, []);

  const maxDaily = behavior ? Math.max(...behavior.dailyViews.map((d) => d.views), 1) : 1;

  return (
    <div className="dashboard-page">
      <h1 className="dashboard-page-title">{t.dashboard.adminAnalyticsTitle}</h1>

      {/* ── General stats ─────────────────────────────────────────── */}
      {loading ? (
        <p style={{ color: "var(--text-muted)" }}>{t.common.loading}</p>
      ) : stats ? (
        <div className="admin-stats" style={{ marginBottom: 40 }}>
          {[
            { label: t.dashboard.adminTotalProperties, value: stats.properties, sub: `${stats.activeProperties} ${t.dashboard.activeCount}` },
            { label: t.dashboard.adminProjects, value: stats.projects },
            { label: t.dashboard.adminBrokersLabel, value: stats.brokers },
            { label: t.dashboard.adminAgenciesLabel, value: stats.agencies },
            { label: t.dashboard.adminUsersLabel, value: stats.users },
            { label: t.dashboard.adminFavorites, value: stats.favorites },
            { label: t.dashboard.adminSavedSearches, value: stats.savedSearches },
          ].map((card) => (
            <div key={card.label} className="admin-stat-card">
              <div className="label">{card.label}</div>
              <div className="value">{card.value.toLocaleString("cs")}</div>
              {card.sub && <div className="sub">{card.sub}</div>}
            </div>
          ))}
        </div>
      ) : null}

      {/* ── Behavioral analytics ──────────────────────────────────── */}
      <h2 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: 20, color: "var(--text-primary)" }}>
        Chování návštěvníků — posledních 7 dní
      </h2>

      {behaviorLoading ? (
        <p style={{ color: "var(--text-muted)" }}>{t.common.loading}</p>
      ) : behaviorError ? (
        <div style={{ padding: "20px", background: "var(--bg-card)", borderRadius: 12, color: "var(--color-error, #ef4444)", border: "1px solid var(--border)" }}>
          ⚠️ {behaviorError}
          {behaviorError.includes("migration") && (
            <p style={{ marginTop: 8, fontSize: "0.85rem", color: "var(--text-muted)" }}>
              Spusť migraci <strong>024_analytics_events.sql</strong> v Supabase SQL editoru.
            </p>
          )}
        </div>
      ) : behavior ? (
        <>
          {/* KPI cards */}
          <div className="admin-stats" style={{ marginBottom: 32 }}>
            {[
              { label: "Celkem událostí", value: behavior.total7d },
              { label: "Unikátní sessions", value: behavior.uniqueSessions },
              { label: "Zobrazení stránek", value: behavior.pageViews7d },
              { label: "Detaily nemovitostí", value: behavior.propViews7d },
            ].map((c) => (
              <div key={c.label} className="admin-stat-card">
                <div className="label">{c.label}</div>
                <div className="value">{c.value.toLocaleString("cs")}</div>
              </div>
            ))}
          </div>

          {/* Daily chart + device + event breakdown */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20, marginBottom: 32 }}>

            {/* Daily views chart */}
            <div style={{ gridColumn: "1 / 3", background: "var(--bg-card)", borderRadius: 12, padding: "20px 24px", border: "1px solid var(--border)" }}>
              <div style={{ fontWeight: 600, marginBottom: 16, fontSize: "0.9rem" }}>Zobrazení stránek — posledních 14 dní</div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 80 }}>
                {behavior.dailyViews.map((d) => (
                  <div key={d.date} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <div
                      title={`${d.date}: ${d.views}`}
                      style={{
                        width: "100%",
                        height: `${Math.max(4, (d.views / maxDaily) * 70)}px`,
                        background: "var(--color-accent, #ffb800)",
                        borderRadius: "3px 3px 0 0",
                        opacity: 0.85,
                      }}
                    />
                    <div style={{ fontSize: "0.6rem", color: "var(--text-muted)", transform: "rotate(-40deg)", whiteSpace: "nowrap" }}>
                      {d.date.slice(5)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Device breakdown */}
            <div style={{ background: "var(--bg-card)", borderRadius: 12, padding: "20px 24px", border: "1px solid var(--border)" }}>
              <div style={{ fontWeight: 600, marginBottom: 16, fontSize: "0.9rem" }}>Zařízení</div>
              {Object.entries(behavior.deviceCounts).map(([device, count]) => {
                const total = Object.values(behavior.deviceCounts).reduce((a, b) => a + b, 0) || 1;
                const pct = Math.round((count / total) * 100);
                return (
                  <div key={device} style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", marginBottom: 3 }}>
                      <span style={{ textTransform: "capitalize" }}>{device}</span>
                      <span style={{ color: "var(--text-muted)" }}>{pct}%</span>
                    </div>
                    <div style={{ height: 6, background: "var(--bg-filter)", borderRadius: 3 }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: "var(--color-accent, #ffb800)", borderRadius: 3 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Event breakdown + top pages + top searches */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20 }}>

            {/* Event breakdown */}
            <div style={{ background: "var(--bg-card)", borderRadius: 12, padding: "20px 24px", border: "1px solid var(--border)" }}>
              <div style={{ fontWeight: 600, marginBottom: 16, fontSize: "0.9rem" }}>Typy událostí</div>
              {behavior.eventBreakdown.map(({ type, count }) => (
                <div key={type} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid var(--border)", fontSize: "0.82rem" }}>
                  <span>{EVENT_LABELS[type] || type}</span>
                  <span style={{ fontWeight: 600 }}>{count.toLocaleString("cs")}</span>
                </div>
              ))}
            </div>

            {/* Top pages */}
            <div style={{ background: "var(--bg-card)", borderRadius: 12, padding: "20px 24px", border: "1px solid var(--border)" }}>
              <div style={{ fontWeight: 600, marginBottom: 16, fontSize: "0.9rem" }}>Nejnavštěvovanější stránky</div>
              {behavior.topPages.map(({ path, views }) => (
                <div key={path} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid var(--border)", fontSize: "0.82rem" }}>
                  <span style={{ color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "75%" }} title={path}>{path}</span>
                  <span style={{ fontWeight: 600, flexShrink: 0 }}>{views}</span>
                </div>
              ))}
            </div>

            {/* Top AI searches */}
            <div style={{ background: "var(--bg-card)", borderRadius: 12, padding: "20px 24px", border: "1px solid var(--border)" }}>
              <div style={{ fontWeight: 600, marginBottom: 16, fontSize: "0.9rem" }}>AI vyhledávání</div>
              {behavior.topSearches.length === 0 ? (
                <p style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>Zatím žádné AI dotazy</p>
              ) : behavior.topSearches.map(({ query, count }) => (
                <div key={query} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid var(--border)", fontSize: "0.82rem" }}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "80%" }} title={query}>{query}</span>
                  <span style={{ fontWeight: 600, flexShrink: 0 }}>{count}×</span>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
