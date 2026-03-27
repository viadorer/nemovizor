"use client";

import { useEffect, useState } from "react";
import { useT } from "@/i18n/provider";

type Service = {
  id: string; code: string; name: string; description: string | null;
  base_price: number; base_price_display: number; currency: string;
  duration_days: number | null; category: string; active: boolean;
};

const CATEGORY_LABELS: Record<string, string> = {
  listing: "Inzerce", tip: "TIP / Zvýraznění", broker_promo: "Promo makléře",
  agency_promo: "Promo kanceláře", project: "Projekt",
};
const SYMS: Record<string, string> = { czk: "Kč", eur: "€", chf: "CHF", gbp: "£" };

export default function AdminServiceCatalogPage() {
  const t = useT();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/service-catalog")
      .then((r) => r.json())
      .then((d) => setServices(d.services || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function toggleActive(id: string, active: boolean) {
    await fetch("/api/admin/service-catalog", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, active: !active }),
    });
    setServices((prev) => prev.map((s) => s.id === id ? { ...s, active: !active } : s));
  }

  // Group by category
  const grouped = services.reduce<Record<string, Service[]>>((acc, s) => {
    const cat = s.category || "other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(s);
    return acc;
  }, {});

  return (
    <div className="dashboard-page">
      <h1 className="dashboard-page-title">Ceník služeb</h1>

      {loading ? <p style={{ color: "var(--text-muted)" }}>{t.common.loading}</p> : services.length === 0 ? (
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
                    <th style={{ textAlign: "left", padding: "8px 12px", borderBottom: "1px solid var(--border)", fontSize: 13, color: "var(--text-muted)" }}>Kód</th>
                    <th style={{ textAlign: "left", padding: "8px 12px", borderBottom: "1px solid var(--border)", fontSize: 13, color: "var(--text-muted)" }}>Název</th>
                    <th style={{ textAlign: "left", padding: "8px 12px", borderBottom: "1px solid var(--border)", fontSize: 13, color: "var(--text-muted)" }}>Popis</th>
                    <th style={{ textAlign: "right", padding: "8px 12px", borderBottom: "1px solid var(--border)", fontSize: 13, color: "var(--text-muted)" }}>Základní cena</th>
                    <th style={{ textAlign: "center", padding: "8px 12px", borderBottom: "1px solid var(--border)", fontSize: 13, color: "var(--text-muted)" }}>Trvání</th>
                    <th style={{ textAlign: "center", padding: "8px 12px", borderBottom: "1px solid var(--border)", fontSize: 13, color: "var(--text-muted)" }}>Stav</th>
                    <th style={{ textAlign: "right", padding: "8px 12px", borderBottom: "1px solid var(--border)", fontSize: 13, color: "var(--text-muted)" }}>Akce</th>
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
                        <button className="admin-btn" style={{ fontSize: "0.75rem", padding: "4px 10px" }} onClick={() => toggleActive(s.id, s.active)}>
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
      )}
    </div>
  );
}
