"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { getBrowserSupabase } from "@/lib/supabase-browser";

type ValuationReport = {
  id: string;
  email: string;
  estimated_price: number;
  price_range_min: number;
  price_range_max: number;
  price_per_m2: number;
  property_params: {
    address?: string;
    city?: string;
    propertyType?: string;
    floorArea?: number;
    localType?: string;
  };
  pdf_url: string | null;
  paid: boolean;
  amount_paid: number;
  created_at: string;
  gemini_text: string | null;
};

const TYPE_LABELS: Record<string, string> = { flat: "Byt", house: "Dům", land: "Pozemek" };

export default function MojeOceneniPage() {
  const { user } = useAuth();
  const [reports, setReports] = useState<ValuationReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const supabase = getBrowserSupabase();
    if (!supabase) return;

    (async () => {
      const { data } = await supabase
        .from("valuation_reports")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      // Also try by email if no user_id matches
      if (!data || data.length === 0) {
        const { data: byEmail } = await supabase
          .from("valuation_reports")
          .select("*")
          .eq("email", user.email)
          .order("created_at", { ascending: false });
        setReports((byEmail as ValuationReport[]) || []);
      } else {
        setReports((data as ValuationReport[]) || []);
      }

      setLoading(false);
    })();
  }, [user]);

  const fmtPrice = (n: number) => n ? `${Math.round(n).toLocaleString("cs")} Kč` : "—";
  const fmtDate = (d: string) => new Date(d).toLocaleDateString("cs-CZ", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="dashboard-page">
      <h1 className="dashboard-page-title">Moje ocenění</h1>

      {loading ? (
        <p style={{ color: "var(--text-muted)" }}>Načítám...</p>
      ) : reports.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-muted)" }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: "0 auto 16px", display: "block", opacity: 0.4 }}>
            <path d="M9 7h6M9 11h6M9 15h4M4 3h16a1 1 0 011 1v16a1 1 0 01-1 1H4a1 1 0 01-1-1V4a1 1 0 011-1z" />
          </svg>
          <p>Zatím nemáte žádná ocenění.</p>
          <a href="/oceneni" style={{ color: "var(--color-accent, #ffb800)", fontWeight: 600, marginTop: 8, display: "inline-block" }}>
            Nechat ocenit nemovitost
          </a>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {reports.map((r) => {
            const params = r.property_params || {};
            const isExpanded = expanded === r.id;

            return (
              <div key={r.id} style={{ background: "var(--bg-card)", borderRadius: 12, border: "1px solid var(--border)", overflow: "hidden" }}>
                {/* Header row */}
                <button
                  onClick={() => setExpanded(isExpanded ? null : r.id)}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 16, padding: "16px 20px",
                    border: "none", background: "transparent", cursor: "pointer", textAlign: "left",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: "0.95rem", color: "var(--text)" }}>
                      {params.address || params.city || "Nemovitost"}
                    </div>
                    <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginTop: 2 }}>
                      {TYPE_LABELS[params.propertyType || ""] || params.propertyType || ""}
                      {params.localType ? ` · ${params.localType}` : ""}
                      {params.floorArea ? ` · ${params.floorArea} m²` : ""}
                      {" · "}
                      {fmtDate(r.created_at)}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 700, fontSize: "1.1rem", color: "var(--text)" }}>
                      {fmtPrice(r.estimated_price)}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                      {fmtPrice(r.price_per_m2)}/m²
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    {r.pdf_url && (
                      <span style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e", borderRadius: 6, padding: "2px 8px", fontSize: "0.72rem", fontWeight: 600 }}>
                        PDF
                      </span>
                    )}
                    {r.paid && (
                      <span style={{ background: "rgba(255,184,0,0.15)", color: "#d4a000", borderRadius: 6, padding: "2px 8px", fontSize: "0.72rem", fontWeight: 600 }}>
                        Zaplaceno
                      </span>
                    )}
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"
                      style={{ transform: isExpanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </div>
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div style={{ padding: "0 20px 20px", borderTop: "1px solid var(--border)" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginTop: 16 }}>
                      <div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: 4 }}>Rozsah ceny</div>
                        <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>
                          {fmtPrice(r.price_range_min)} – {fmtPrice(r.price_range_max)}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: 4 }}>Průměrná cena</div>
                        <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{fmtPrice(r.estimated_price)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: 4 }}>Cena za m²</div>
                        <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{fmtPrice(r.price_per_m2)}/m²</div>
                      </div>
                    </div>

                    {r.gemini_text && (
                      <div style={{ marginTop: 16, padding: "14px 16px", background: "var(--bg-filter, var(--bg))", borderRadius: 10, fontSize: "0.85rem", lineHeight: 1.6, color: "var(--text)" }}>
                        <div style={{ fontWeight: 600, marginBottom: 6, fontSize: "0.82rem", color: "var(--text-muted)" }}>AI komentář</div>
                        {r.gemini_text.replace(/\*\*/g, "").replace(/#{1,3}\s/g, "").slice(0, 500)}
                        {r.gemini_text.length > 500 ? "..." : ""}
                      </div>
                    )}

                    <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {r.pdf_url && r.paid ? (
                        <a href={r.pdf_url} target="_blank" rel="noopener" style={{
                          padding: "8px 20px", borderRadius: 8, background: "var(--color-accent, #ffb800)", color: "#000",
                          fontWeight: 600, fontSize: "0.85rem", textDecoration: "none",
                        }}>
                          Stáhnout PDF report
                        </a>
                      ) : (
                        <button
                          onClick={async () => {
                            // Pay with wallet credits
                            const res = await fetch("/api/valuation/report", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ valuationId: r.id, userId: user?.id }),
                            });
                            const data = await res.json();
                            if (data.pdf_url) {
                              setReports((prev) => prev.map((rr) => rr.id === r.id ? { ...rr, pdf_url: data.pdf_url, paid: true, gemini_text: data.report_data?.ai_commentary || rr.gemini_text } : rr));
                              window.open(data.pdf_url, "_blank");
                            } else if (data.error) {
                              alert(data.error);
                            }
                          }}
                          style={{
                            padding: "8px 20px", borderRadius: 8, border: "1px solid var(--border)",
                            background: "var(--bg-card)", fontWeight: 600, fontSize: "0.85rem", cursor: "pointer",
                          }}
                        >
                          Získat PDF report (50 kr)
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
