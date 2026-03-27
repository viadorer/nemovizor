"use client";

import { useEffect, useState } from "react";
import { useT } from "@/i18n/provider";

type Stats = { properties: number; activeProperties: number; brokers: number; agencies: number; users: number; favorites: number; savedSearches: number; projects: number };

type BehaviorStats = {
  total7d: number; uniqueSessions: number; pageViews7d: number; propViews7d: number;
  contactClicks: number; favActions: number; bounceRate: number; avgScrollDepth: number; avgTimeOnPage: number;
  eventBreakdown: { type: string; count: number }[];
  deviceCounts: Record<string, number>;
  topPages: { path: string; views: number }[];
  topProperties: { id: string; count: number; slug: string; city: string; title?: string; price?: number; price_currency?: string; image_src?: string; listing_type?: string; category?: string; area?: number; rooms_label?: string }[];
  topSearches: { query: string; count: number }[];
  referrerSources: { source: string; count: number }[];
  utmCampaigns: { campaign: string; count: number }[];
  filterUsage: { filter: string; count: number }[];
  hourCounts: number[];
  funnel: { step: string; sessions: number }[];
  dailyViews: { date: string; views: number }[];
};

const EVENT_LABELS: Record<string, string> = {
  page_view: "Zobrazení stránky", property_view: "Detail nemovitosti", property_impression: "Imprese karty",
  scroll_depth: "Scroll hloubka", time_on_page: "Čas na stránce", filter_change: "Změna filtru",
  ai_search: "AI vyhledávání", map_pin_click: "Klik na mapě", favorite_toggle: "Oblíbené",
  phone_click: "Klik na telefon", email_click: "Klik na email", contact_broker_click: "Kontakt makléře",
};

// ── Reusable card wrapper ──────────────────────────────────────────────
function Card({ title, children, span }: { title: string; children: React.ReactNode; span?: number }) {
  return (
    <div style={{ gridColumn: span ? `span ${span}` : undefined, background: "var(--bg-card)", borderRadius: 12, padding: "20px 24px", border: "1px solid var(--border)" }}>
      <div style={{ fontWeight: 600, marginBottom: 16, fontSize: "0.9rem" }}>{title}</div>
      {children}
    </div>
  );
}

function Row({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid var(--border)", fontSize: "0.82rem" }}>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "72%" }} title={String(label)}>{label}</span>
      <span style={{ fontWeight: 600, flexShrink: 0 }}>{typeof value === "number" ? value.toLocaleString("cs") : value}{sub ? <span style={{ fontWeight: 400, color: "var(--text-muted)", marginLeft: 4 }}>{sub}</span> : null}</span>
    </div>
  );
}

function Bar({ label, pct }: { label: string; pct: number }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", marginBottom: 3 }}>
        <span style={{ textTransform: "capitalize" }}>{label}</span>
        <span style={{ color: "var(--text-muted)" }}>{pct}%</span>
      </div>
      <div style={{ height: 6, background: "var(--bg-filter)", borderRadius: 3 }}>
        <div style={{ height: "100%", width: `${pct}%`, background: "var(--color-accent, #ffb800)", borderRadius: 3 }} />
      </div>
    </div>
  );
}

export default function AdminAnalyticsPage() {
  const t = useT();
  const [stats, setStats] = useState<Stats | null>(null);
  const [b, setB] = useState<BehaviorStats | null>(null);
  const [bError, setBError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [bLoading, setBLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/analytics").then((r) => r.json()).then(setStats).finally(() => setLoading(false));
    fetch("/api/admin/analytics-behavior").then((r) => r.json()).then((d) => { if (d.error) setBError(d.error); else setB(d); }).catch(() => setBError("Chyba")).finally(() => setBLoading(false));
  }, []);

  const maxDaily = b ? Math.max(...b.dailyViews.map((d) => d.views), 1) : 1;
  const maxHour = b ? Math.max(...b.hourCounts, 1) : 1;
  const funnelMax = b ? Math.max(...b.funnel.map((f) => f.sessions), 1) : 1;

  return (
    <div className="dashboard-page">
      <h1 className="dashboard-page-title">{t.dashboard.adminAnalyticsTitle}</h1>

      {/* ── General stats ──────────────────────────────────────── */}
      {loading ? <p style={{ color: "var(--text-muted)" }}>{t.common.loading}</p> : stats ? (
        <div className="admin-stats" style={{ marginBottom: 40 }}>
          {[
            { label: t.dashboard.adminTotalProperties, value: stats.properties, sub: `${stats.activeProperties} ${t.dashboard.activeCount}` },
            { label: t.dashboard.adminProjects, value: stats.projects },
            { label: t.dashboard.adminBrokersLabel, value: stats.brokers },
            { label: t.dashboard.adminAgenciesLabel, value: stats.agencies },
            { label: t.dashboard.adminUsersLabel, value: stats.users },
            { label: t.dashboard.adminFavorites, value: stats.favorites },
            { label: t.dashboard.adminSavedSearches, value: stats.savedSearches },
          ].map((c) => (
            <div key={c.label} className="admin-stat-card">
              <div className="label">{c.label}</div>
              <div className="value">{c.value.toLocaleString("cs")}</div>
              {c.sub && <div className="sub">{c.sub}</div>}
            </div>
          ))}
        </div>
      ) : null}

      {/* ── Behavioral analytics ─────────────────────────────── */}
      <h2 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: 20 }}>Chování návštěvníků — posledních 7 dní</h2>

      {bLoading ? <p style={{ color: "var(--text-muted)" }}>{t.common.loading}</p> : bError ? (
        <div style={{ padding: 20, background: "var(--bg-card)", borderRadius: 12, color: "#ef4444", border: "1px solid var(--border)" }}>
          ⚠️ {bError}
          {bError.includes("migration") && <p style={{ marginTop: 8, fontSize: "0.85rem", color: "var(--text-muted)" }}>Spusť migraci <strong>024_analytics_events.sql</strong> v Supabase SQL editoru.</p>}
        </div>
      ) : b ? (
        <>
          {/* KPI row */}
          <div className="admin-stats" style={{ marginBottom: 24 }}>
            {[
              { label: "Unikátní sessions", value: b.uniqueSessions },
              { label: "Zobrazení stránek", value: b.pageViews7d },
              { label: "Detaily nemovitostí", value: b.propViews7d },
              { label: "Kontaktní akce", value: b.contactClicks },
              { label: "Oblíbené akce", value: b.favActions },
              { label: "Bounce rate", value: `${b.bounceRate}%` },
              { label: "Avg scroll depth", value: `${b.avgScrollDepth}%` },
              { label: "Avg čas na detailu", value: `${b.avgTimeOnPage}s` },
            ].map((c) => (
              <div key={c.label} className="admin-stat-card">
                <div className="label">{c.label}</div>
                <div className="value">{typeof c.value === "number" ? c.value.toLocaleString("cs") : c.value}</div>
              </div>
            ))}
          </div>

          {/* ── Row 1: Daily chart + Funnel ────────────────────── */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20, marginBottom: 20 }}>
            <Card title="Zobrazení stránek — 14 dní">
              <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 90 }}>
                {b.dailyViews.map((d) => (
                  <div key={d.date} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <div style={{ fontSize: "0.55rem", color: "var(--text-muted)" }}>{d.views}</div>
                    <div title={`${d.date}: ${d.views}`} style={{ width: "100%", height: `${Math.max(4, (d.views / maxDaily) * 70)}px`, background: "var(--color-accent, #ffb800)", borderRadius: "3px 3px 0 0", opacity: 0.85 }} />
                    <div style={{ fontSize: "0.55rem", color: "var(--text-muted)", transform: "rotate(-40deg)", whiteSpace: "nowrap" }}>{d.date.slice(5)}</div>
                  </div>
                ))}
              </div>
            </Card>

            <Card title="Konverzní funnel">
              {b.funnel.map((f, i) => {
                const pct = Math.round((f.sessions / funnelMax) * 100);
                const prevSessions = i > 0 ? b.funnel[i - 1].sessions : f.sessions;
                const dropoff = prevSessions > 0 ? Math.round(((prevSessions - f.sessions) / prevSessions) * 100) : 0;
                return (
                  <div key={f.step} style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", marginBottom: 2 }}>
                      <span>{f.step}</span>
                      <span style={{ fontWeight: 600 }}>{f.sessions}{i > 0 && dropoff > 0 ? <span style={{ color: "#ef4444", marginLeft: 4, fontWeight: 400, fontSize: "0.7rem" }}>-{dropoff}%</span> : null}</span>
                    </div>
                    <div style={{ height: 8, background: "var(--bg-filter)", borderRadius: 4 }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: i === b.funnel.length - 1 ? "#22c55e" : "var(--color-accent, #ffb800)", borderRadius: 4, transition: "width 0.3s" }} />
                    </div>
                  </div>
                );
              })}
            </Card>
          </div>

          {/* ── Row 2: Hourly heatmap + Device + Referrer ──────── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20, marginBottom: 20 }}>
            <Card title="Aktivita po hodinách">
              <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 60 }}>
                {b.hourCounts.map((c, h) => (
                  <div key={h} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                    <div style={{ width: "100%", height: `${Math.max(2, (c / maxHour) * 50)}px`, background: `hsl(${40 + (c / maxHour) * 0}, ${70 + (c / maxHour) * 30}%, ${55 - (c / maxHour) * 15}%)`, borderRadius: 2, opacity: 0.85 }} title={`${h}:00 — ${c} views`} />
                    <div style={{ fontSize: "0.5rem", color: "var(--text-muted)" }}>{h}</div>
                  </div>
                ))}
              </div>
            </Card>

            <Card title="Zařízení">
              {Object.entries(b.deviceCounts).map(([dev, count]) => {
                const total = Object.values(b.deviceCounts).reduce((a, bb) => a + bb, 0) || 1;
                return <Bar key={dev} label={dev} pct={Math.round((count / total) * 100)} />;
              })}
            </Card>

            <Card title="Zdroje návštěvníků">
              {b.referrerSources.length === 0 ? <p style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>Vše přímé návštěvy</p> : b.referrerSources.map((r) => <Row key={r.source} label={r.source} value={r.count} />)}
            </Card>
          </div>

          {/* ── Row 3: Event types + Top pages + Top properties ── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20, marginBottom: 20 }}>
            <Card title="Typy událostí">
              {b.eventBreakdown.map(({ type, count }) => <Row key={type} label={EVENT_LABELS[type] || type} value={count} />)}
            </Card>

            <Card title="Nejnavštěvovanější stránky">
              {b.topPages.map(({ path, views }) => <Row key={path} label={path} value={views} />)}
            </Card>

            <Card title="Top nemovitosti (detaily)">
              {b.topProperties.length === 0 ? <p style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>Zatím žádné detaily</p> : b.topProperties.map((p) => (
                <a key={p.id} href={`/nemovitost/${p.slug}`} target="_blank" rel="noopener" style={{ display: "flex", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--border)", textDecoration: "none", color: "inherit", alignItems: "center" }}>
                  <div style={{ width: 56, height: 42, borderRadius: 6, overflow: "hidden", flexShrink: 0, background: "var(--bg-filter)" }}>
                    {p.image_src && !p.image_src.includes("placeholder") ? (
                      <img src={p.image_src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></svg>
                      </div>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "0.78rem", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.title || p.slug}</div>
                    <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                      {p.city}{p.rooms_label ? ` • ${p.rooms_label}` : ""}{p.area ? ` • ${p.area} m²` : ""}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--color-accent, #ffb800)" }}>
                      {p.price ? `${(p.price).toLocaleString("cs")} ${(p.price_currency || "CZK").toUpperCase()}` : "—"}
                    </div>
                    <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{p.count}× zobrazení</div>
                  </div>
                </a>
              ))}
            </Card>
          </div>

          {/* ── Row 4: Filters + UTM + AI searches ───────────── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20 }}>
            <Card title="Nejpoužívanější filtry">
              {b.filterUsage.length === 0 ? <p style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>Zatím žádné filtry</p> : b.filterUsage.map((f) => <Row key={f.filter} label={f.filter} value={f.count} />)}
            </Card>

            <Card title="UTM kampaně">
              {b.utmCampaigns.length === 0 ? <p style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>Žádné UTM parametry</p> : b.utmCampaigns.map((u) => <Row key={u.campaign} label={u.campaign} value={u.count} />)}
            </Card>

            <Card title="AI vyhledávání">
              {b.topSearches.length === 0 ? <p style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>Zatím žádné AI dotazy</p> : b.topSearches.map(({ query, count }) => <Row key={query} label={query} value={`${count}×`} />)}
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}
