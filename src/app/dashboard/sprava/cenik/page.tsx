"use client";

import { useEffect, useState } from "react";
import { useT } from "@/i18n/provider";

type Service = {
  id: string; code: string; name: string; description: string | null;
  base_price: number; base_price_display: number; currency: string;
  duration_days: number | null; category: string; active: boolean;
};

type ListingPrice = {
  id: string; country: string; region: string | null; city: string | null;
  listing_type: string | null; price_per_day: number; price_display: number;
  currency: string; active: boolean;
};

type VolumeDiscount = {
  id: string; country: string; min_listings: number;
  max_listings: number | null; discount_pct: number;
};

const CATEGORY_LABELS: Record<string, string> = {
  listing: "Inzerce", tip: "TIP / Zvýraznění", broker_promo: "Promo makléře",
  agency_promo: "Promo kanceláře", project: "Projekt",
};
const SYMS: Record<string, string> = { czk: "Kč", eur: "€", chf: "CHF", gbp: "£" };
const COUNTRIES: Record<string, string> = { cz: "Česko", fr: "Francie", ch: "Švýcarsko", es: "Španělsko", it: "Itálie", uk: "UK", de: "Německo" };
const TYPE_LABELS: Record<string, string> = { sale: "Prodej", rent: "Pronájem" };

export default function AdminServiceCatalogPage() {
  const t = useT();
  const [services, setServices] = useState<Service[]>([]);
  const [pricing, setPricing] = useState<ListingPrice[]>([]);
  const [discounts, setDiscounts] = useState<VolumeDiscount[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"services" | "pricing" | "discounts">("services");

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/service-catalog").then((r) => r.json()),
      fetch("/api/admin/listing-pricing").then((r) => r.json()),
    ])
      .then(([svc, lp]) => {
        setServices(svc.services || []);
        setPricing(lp.pricing || []);
        setDiscounts(lp.discounts || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function toggleService(id: string, active: boolean) {
    await fetch("/api/admin/service-catalog", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, active: !active }),
    });
    setServices((prev) => prev.map((s) => s.id === id ? { ...s, active: !active } : s));
  }

  async function updatePrice(id: string, newPrice: number) {
    await fetch("/api/admin/listing-pricing", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, price_per_day: newPrice }),
    });
    setPricing((prev) => prev.map((p) => p.id === id ? { ...p, price_display: newPrice, price_per_day: Math.round(newPrice * 100) } : p));
  }

  // Group services by category
  const grouped = services.reduce<Record<string, Service[]>>((acc, s) => {
    const cat = s.category || "other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(s);
    return acc;
  }, {});

  // Group pricing by country
  const pricingByCountry = pricing.reduce<Record<string, ListingPrice[]>>((acc, p) => {
    if (!acc[p.country]) acc[p.country] = [];
    acc[p.country].push(p);
    return acc;
  }, {});

  // Group discounts by country
  const discountsByCountry = discounts.reduce<Record<string, VolumeDiscount[]>>((acc, d) => {
    if (!acc[d.country]) acc[d.country] = [];
    acc[d.country].push(d);
    return acc;
  }, {});

  const tabStyle = (active: boolean) => ({
    padding: "8px 20px", borderRadius: 8, border: "1px solid var(--border)",
    background: active ? "var(--color-accent, #ffb800)" : "var(--bg-card)",
    color: active ? "#000" : "inherit", fontWeight: 600 as const,
    fontSize: "0.85rem", cursor: "pointer" as const,
  });

  return (
    <div className="dashboard-page">
      <h1 className="dashboard-page-title">Ceník služeb</h1>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        <button style={tabStyle(tab === "services")} onClick={() => setTab("services")}>Služby</button>
        <button style={tabStyle(tab === "pricing")} onClick={() => setTab("pricing")}>Denní sazby inzerce</button>
        <button style={tabStyle(tab === "discounts")} onClick={() => setTab("discounts")}>Objemové slevy</button>
      </div>

      {loading ? <p style={{ color: "var(--text-muted)" }}>{t.common.loading}</p> : (
        <>
          {/* ─── TAB: Služby ─────────────────────────────────────── */}
          {tab === "services" && (
            services.length === 0 ? (
              <p style={{ color: "var(--text-muted)" }}>Žádné služby v katalogu. Spusťte migraci 025.</p>
            ) : (
              Object.entries(grouped).map(([cat, items]) => (
                <div key={cat} style={{ marginBottom: 32 }}>
                  <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 12, color: "var(--text-muted)" }}>
                    {CATEGORY_LABELS[cat] || cat}
                  </h2>
                  <div style={{ overflowX: "auto" }}>
                    <table className="admin-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr>
                          {["Kód", "Název", "Popis", "Základní cena", "Trvání", "Stav", "Akce"].map((h, i) => (
                            <th key={h} style={{ textAlign: i === 3 ? "right" : i >= 4 ? "center" : "left", padding: "8px 12px", borderBottom: "1px solid var(--border)", fontSize: 13, color: "var(--text-muted)" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((s) => (
                          <tr key={s.id} style={{ opacity: s.active ? 1 : 0.5 }}>
                            <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", fontSize: "0.82rem", fontFamily: "monospace" }}>{s.code}</td>
                            <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", fontWeight: 500 }}>{s.name}</td>
                            <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", fontSize: "0.82rem", color: "var(--text-muted)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.description || "—"}</td>
                            <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", textAlign: "right", fontWeight: 600 }}>
                              {s.base_price_display.toLocaleString("cs", { minimumFractionDigits: 2 })} {SYMS[s.currency] || s.currency.toUpperCase()}
                            </td>
                            <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", textAlign: "center", fontSize: "0.82rem" }}>
                              {s.duration_days ? `${s.duration_days} dní` : "Trvalé"}
                            </td>
                            <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", textAlign: "center" }}>
                              <span style={{ fontSize: "0.78rem", fontWeight: 600, color: s.active ? "#22c55e" : "#ef4444" }}>
                                {s.active ? "Aktivní" : "Neaktivní"}
                              </span>
                            </td>
                            <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", textAlign: "right" }}>
                              <button className="admin-btn" style={{ fontSize: "0.75rem", padding: "4px 10px" }} onClick={() => toggleService(s.id, s.active)}>
                                {s.active ? "Deaktivovat" : "Aktivovat"}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))
            )
          )}

          {/* ─── TAB: Denní sazby inzerce ────────────────────────── */}
          {tab === "pricing" && (
            pricing.length === 0 ? (
              <p style={{ color: "var(--text-muted)" }}>Žádné sazby. Spusťte migraci 026.</p>
            ) : (
              Object.entries(pricingByCountry).map(([country, items]) => (
                <div key={country} style={{ marginBottom: 32 }}>
                  <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 12 }}>
                    {COUNTRIES[country] || country.toUpperCase()}
                    <span style={{ fontWeight: 400, fontSize: "0.82rem", color: "var(--text-muted)", marginLeft: 8 }}>
                      ({items[0]?.currency?.toUpperCase()})
                    </span>
                  </h2>
                  <div style={{ overflowX: "auto" }}>
                    <table className="admin-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr>
                          {["Město / Region", "Typ", "Cena/den", "Akce"].map((h, i) => (
                            <th key={h} style={{ textAlign: i === 2 ? "right" : i === 3 ? "center" : "left", padding: "8px 12px", borderBottom: "1px solid var(--border)", fontSize: 13, color: "var(--text-muted)" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {items.sort((a, b) => (a.city || "zzz").localeCompare(b.city || "zzz")).map((p) => (
                          <PricingRow key={p.id} p={p} onUpdate={updatePrice} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))
            )
          )}

          {/* ─── TAB: Objemové slevy ─────────────────────────────── */}
          {tab === "discounts" && (
            discounts.length === 0 ? (
              <p style={{ color: "var(--text-muted)" }}>Žádné objemové slevy. Spusťte migraci 026.</p>
            ) : (
              Object.entries(discountsByCountry).map(([country, items]) => (
                <div key={country} style={{ marginBottom: 32 }}>
                  <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 12 }}>
                    {COUNTRIES[country] || country.toUpperCase()}
                  </h2>
                  <div style={{ overflowX: "auto" }}>
                    <table className="admin-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr>
                          {["Od inzerátů", "Do inzerátů", "Sleva"].map((h, i) => (
                            <th key={h} style={{ textAlign: i === 2 ? "right" : "left", padding: "8px 12px", borderBottom: "1px solid var(--border)", fontSize: 13, color: "var(--text-muted)" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {items.sort((a, b) => a.min_listings - b.min_listings).map((d) => (
                          <tr key={d.id}>
                            <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)" }}>{d.min_listings}</td>
                            <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)" }}>{d.max_listings ?? "∞"}</td>
                            <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", textAlign: "right", fontWeight: 600, color: d.discount_pct > 0 ? "#22c55e" : "inherit" }}>
                              {d.discount_pct}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))
            )
          )}
        </>
      )}
    </div>
  );
}

// ─── Inline editable pricing row ──────────────────────────────
function PricingRow({ p, onUpdate }: { p: ListingPrice; onUpdate: (id: string, price: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(p.price_display));

  const sym = SYMS[p.currency] || p.currency.toUpperCase();

  function save() {
    const num = parseFloat(val.replace(",", "."));
    if (!isNaN(num) && num >= 0) {
      onUpdate(p.id, num);
    }
    setEditing(false);
  }

  return (
    <tr>
      <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", fontWeight: 500 }}>
        {p.city || p.region || <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>Výchozí (celá země)</span>}
      </td>
      <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", fontSize: "0.82rem" }}>
        {p.listing_type ? TYPE_LABELS[p.listing_type] || p.listing_type : <span style={{ color: "var(--text-muted)" }}>Vše</span>}
      </td>
      <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", textAlign: "right", fontWeight: 600 }}>
        {editing ? (
          <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
            <input
              type="text"
              value={val}
              onChange={(e) => setVal(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && save()}
              onBlur={save}
              autoFocus
              style={{ width: 80, padding: "2px 6px", border: "1px solid var(--border)", borderRadius: 4, textAlign: "right", fontSize: "0.85rem" }}
            />
            <span style={{ fontSize: "0.82rem" }}>{sym}</span>
          </span>
        ) : (
          <span>{p.price_display.toLocaleString("cs", { minimumFractionDigits: 2 })} {sym}/den</span>
        )}
      </td>
      <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", textAlign: "center" }}>
        <button
          className="admin-btn"
          style={{ fontSize: "0.75rem", padding: "4px 10px" }}
          onClick={() => { setVal(String(p.price_display)); setEditing(!editing); }}
        >
          {editing ? "Zrušit" : "Upravit"}
        </button>
      </td>
    </tr>
  );
}
