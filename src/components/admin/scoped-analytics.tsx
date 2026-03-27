"use client";

import { useEffect, useState } from "react";

type BehaviorStats = {
  totalProperties: number; total7d: number; uniqueSessions: number; propViews7d: number;
  impressions7d: number; contactClicks: number; favActions: number; mapClicks: number;
  avgScrollDepth: number; avgTimeOnPage: number;
  eventBreakdown: { type: string; count: number }[];
  deviceCounts: Record<string, number>;
  topProperties: { id: string; count: number; slug: string; city: string; title?: string; price?: number; price_currency?: string; image_src?: string; listing_type?: string; category?: string; area?: number; rooms_label?: string }[];
  hourCounts: number[];
  funnel: { step: string; sessions: number }[];
  dailyViews: { date: string; views: number }[];
  contactRequests: number;
  newContactRequests: number;
};

const EVENT_LABELS: Record<string, string> = {
  page_view: "Zobrazení stránky", property_view: "Detail nemovitosti", property_impression: "Imprese karty",
  scroll_depth: "Scroll hloubka", time_on_page: "Čas na stránce", filter_change: "Změna filtru",
  ai_search: "AI vyhledávání", map_pin_click: "Klik na mapě", favorite_toggle: "Oblíbené",
  phone_click: "Klik na telefon", email_click: "Klik na email", contact_broker_click: "Kontakt makléře",
};

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--bg-card)", borderRadius: 12, padding: "20px 24px", border: "1px solid var(--border)" }}>
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
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", marginBottom: 3 }}>
        <span>{label}</span><span style={{ fontWeight: 600 }}>{pct}%</span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: "var(--bg-filter)" }}>
        <div style={{ height: "100%", borderRadius: 3, background: "var(--color-accent, #ffb800)", width: `${pct}%` }} />
      </div>
    </div>
  );
}

function KPI({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="admin-stat-card">
      <div className="label">{label}</div>
      <div className="value">{typeof value === "number" ? value.toLocaleString("cs") : value}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}

/**
 * Shared analytics component scoped to a broker or agency.
 * Used by:
 *   - /dashboard/moje-analytika (logged-in broker/agency)
 *   - /dashboard/sprava/makleri/[id]/analytika (admin viewing broker)
 *   - /dashboard/sprava/kancelare/[id]/analytika (admin viewing agency)
 */
export default function ScopedAnalytics({ brokerId, agencyId }: { brokerId?: string; agencyId?: string }) {
  const [b, setB] = useState<BehaviorStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!brokerId && !agencyId) { setLoading(false); return; }
    const param = agencyId ? `agency_id=${agencyId}` : `broker_id=${brokerId}`;
    fetch(`/api/broker/analytics-behavior?${param}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data) setB(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [brokerId, agencyId]);

  if (loading) return <p style={{ color: "var(--text-muted)" }}>Načítání analytiky...</p>;
  if (!b) return <p style={{ color: "var(--text-muted)" }}>Zatím žádná analytická data. Data se začnou sbírat s návštěvností.</p>;

  const maxDaily = Math.max(...b.dailyViews.map((d) => d.views), 1);
  const totalDevice = Object.values(b.deviceCounts).reduce((a, c) => a + c, 0) || 1;
  const maxFunnel = Math.max(b.funnel[0]?.sessions || 1, 1);
  const maxHour = Math.max(...b.hourCounts, 1);

  return (
    <>
      {/* ── KPI row ─────────────────────────────────────────────── */}
      <div className="admin-stats">
        <KPI label="Nabídky celkem" value={b.totalProperties} />
        <KPI label="Zobrazení detailů" value={b.propViews7d} sub="7 dní" />
        <KPI label="Imprese karet" value={b.impressions7d} sub="7 dní" />
        <KPI label="Kontakty (klik)" value={b.contactClicks} sub="tel/email/btn" />
        <KPI label="Unikátní návštěvníci" value={b.uniqueSessions} sub="7 dní" />
        <KPI label="Poptávky" value={b.contactRequests} sub={`${b.newContactRequests} nových`} />
      </div>

      {/* ── Engagement row ──────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16, margin: "20px 0" }}>
        <div className="admin-stat-card">
          <div className="label">Oblíbené</div>
          <div className="value">{b.favActions}</div>
          <div className="sub">přidání/odebrání</div>
        </div>
        <div className="admin-stat-card">
          <div className="label">Kliky na mapě</div>
          <div className="value">{b.mapClicks}</div>
        </div>
        <div className="admin-stat-card">
          <div className="label">Ø Scroll</div>
          <div className="value">{b.avgScrollDepth}%</div>
          <div className="sub">hloubka na detailu</div>
        </div>
        <div className="admin-stat-card">
          <div className="label">Ø Čas na stránce</div>
          <div className="value">{b.avgTimeOnPage}s</div>
        </div>
      </div>

      {/* ── Daily chart + Funnel ────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20, marginBottom: 20 }}>
        <Card title="Zobrazení detailů — posledních 14 dní">
          <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 100 }}>
            {b.dailyViews.map((d) => (
              <div key={d.date} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
                <span style={{ fontSize: "0.65rem", marginBottom: 2 }}>{d.views}</span>
                <div style={{ width: "100%", background: "var(--color-accent, #ffb800)", borderRadius: 2, height: `${(d.views / maxDaily) * 80}px`, minHeight: d.views ? 4 : 1 }} />
                <span style={{ fontSize: "0.6rem", color: "var(--text-muted)", marginTop: 2 }}>{d.date.slice(5)}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Konverzní trychtýř">
          {b.funnel.map((f) => (
            <div key={f.step} style={{ marginBottom: 10, overflow: "hidden" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", marginBottom: 3, gap: 8 }}>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{f.step}</span><span style={{ fontWeight: 700, flexShrink: 0 }}>{f.sessions}</span>
              </div>
              <div style={{ height: 8, borderRadius: 4, background: "var(--bg-filter)" }}>
                <div style={{ height: "100%", borderRadius: 4, background: "var(--color-accent, #ffb800)", width: `${(f.sessions / maxFunnel) * 100}%`, minWidth: f.sessions ? 4 : 0 }} />
              </div>
            </div>
          ))}
        </Card>
      </div>

      {/* ── Devices + Events + Hourly ───────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20, marginBottom: 20 }}>
        <Card title="Zařízení">
          {Object.entries(b.deviceCounts).map(([device, cnt]) => (
            <Bar key={device} label={device} pct={Math.round((cnt / totalDevice) * 100)} />
          ))}
          {Object.keys(b.deviceCounts).length === 0 && <p style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>Zatím žádná data</p>}
        </Card>

        <Card title="Typy událostí">
          {b.eventBreakdown.map(({ type, count }) => <Row key={type} label={EVENT_LABELS[type] || type} value={count} />)}
          {b.eventBreakdown.length === 0 && <p style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>Zatím žádná data</p>}
        </Card>

        <Card title="Aktivita po hodinách">
          <div style={{ display: "flex", alignItems: "flex-end", gap: 1, height: 60 }}>
            {b.hourCounts.map((c, i) => (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ width: "100%", background: c ? "var(--color-accent, #ffb800)" : "var(--bg-filter)", borderRadius: 1, height: `${(c / maxHour) * 50}px`, minHeight: 2 }} />
                {i % 4 === 0 && <span style={{ fontSize: "0.55rem", color: "var(--text-muted)", marginTop: 2 }}>{i}h</span>}
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ── Top properties ──────────────────────────────────────── */}
      <Card title="Nejprohlíženější nabídky">
        {b.topProperties.length === 0 ? <p style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>Zatím žádné detaily</p> : (
          <div className="dashboard-favorites-grid">
            {b.topProperties.map((p) => (
              <div key={p.id} className="dashboard-fav-card" style={{ position: "relative" }}>
                <a href={`/nemovitost/${p.slug}`} target="_blank" rel="noopener" className="dashboard-fav-image">
                  <img src={p.image_src && !p.image_src.includes("placeholder") ? p.image_src : "/branding/placeholder.png"} alt={p.title || ""} />
                  {p.listing_type && (
                    <span className={`property-badge property-badge--${p.listing_type}`}>
                      {p.listing_type === "sale" ? "Prodej" : p.listing_type === "rent" ? "Pronájem" : p.listing_type}
                    </span>
                  )}
                </a>
                <div className="dashboard-fav-info">
                  <span className="dashboard-fav-price">
                    {p.price ? `${p.price.toLocaleString("cs")} ${(p.price_currency || "CZK").toUpperCase()}` : "—"}
                  </span>
                  <span className="dashboard-fav-meta">
                    {p.rooms_label || ""}{p.rooms_label && p.area ? " · " : ""}{p.area ? `${p.area} m²` : ""}
                  </span>
                  <span className="dashboard-fav-location">{p.city || "—"}</span>
                </div>
                <div style={{ position: "absolute", top: 6, right: 6, background: "rgba(0,0,0,0.6)", color: "#fff", borderRadius: 8, padding: "2px 8px", fontSize: "0.72rem", fontWeight: 700 }}>
                  {p.count}× zobrazení
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
