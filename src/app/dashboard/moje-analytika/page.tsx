"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { getBrowserSupabase } from "@/lib/supabase-browser";
import { useT } from "@/i18n/provider";
import ScopedAnalytics from "@/components/admin/scoped-analytics";

type TipStat = {
  propertyId: string; title: string; city: string; featuredUntil: string | null;
  impressions7d: number; clicks7d: number; contacts: number;
};

export default function BrokerAnalyticsPage() {
  const { user } = useAuth();
  const t = useT();
  const [brokerId, setBrokerId] = useState<string | null>(null);
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [scope, setScope] = useState<"broker" | "agency">("broker");
  const [tipStats, setTipStats] = useState<TipStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const supabase = getBrowserSupabase();
    if (!supabase) return;

    (async () => {
      // Detect role: broker with optional agency
      const { data: broker } = await supabase
        .from("brokers")
        .select("id, agency_id")
        .eq("user_id", user.id)
        .single();

      if (broker) {
        setBrokerId(broker.id);
        if (broker.agency_id) setAgencyId(broker.agency_id);

        // Load TIP stats for featured properties
        const { data: featuredProps } = await supabase
          .from("properties")
          .select("id, title, city, featured_until")
          .eq("broker_id", broker.id)
          .eq("featured", true)
          .eq("active", true);

        if (featuredProps && featuredProps.length > 0) {
          const propIds = featuredProps.map((p) => p.id);
          const [{ data: views7d }, { data: contacts }] = await Promise.all([
            supabase.from("property_views").select("property_id, view_type").in("property_id", propIds).gte("viewed_at", new Date(Date.now() - 7 * 86400_000).toISOString()),
            supabase.from("contact_requests").select("property_id").in("property_id", propIds),
          ]);
          setTipStats(featuredProps.map((prop) => ({
            propertyId: prop.id,
            title: prop.title || prop.city || "—",
            city: prop.city || "",
            featuredUntil: prop.featured_until,
            impressions7d: (views7d || []).filter((v) => v.property_id === prop.id && v.view_type === "tip_impression").length,
            clicks7d: (views7d || []).filter((v) => v.property_id === prop.id && v.view_type === "detail_click").length,
            contacts: (contacts || []).filter((c) => c.property_id === prop.id).length,
          })));
        }
      } else {
        // Maybe user owns an agency directly (without being a broker)
        const { data: agency } = await supabase
          .from("agencies")
          .select("id")
          .eq("user_id", user.id)
          .single();
        if (agency) {
          setAgencyId(agency.id);
          setScope("agency");
        }
      }

      setLoading(false);
    })();
  }, [user]);

  const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString("cs-CZ") : "—";

  if (loading) return <div className="dashboard-page"><p style={{ color: "var(--text-muted)" }}>{t.common.loading}</p></div>;
  if (!brokerId && !agencyId) return <div className="dashboard-page"><h1 className="dashboard-page-title">{t.dashboard.myAnalyticsTitle}</h1><p style={{ color: "var(--text-muted)" }}>Nejste přiřazeni jako makléř ani kancelář.</p></div>;

  return (
    <div className="dashboard-page">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 className="dashboard-page-title" style={{ marginBottom: 0 }}>{t.dashboard.myAnalyticsTitle}</h1>
        {brokerId && agencyId && (
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => setScope("broker")}
              style={{ padding: "6px 16px", borderRadius: 8, border: "1px solid var(--border)", background: scope === "broker" ? "var(--color-accent, #ffb800)" : "var(--bg-card)", color: scope === "broker" ? "#000" : "inherit", fontWeight: 600, fontSize: "0.82rem", cursor: "pointer" }}
            >Moje nabídky</button>
            <button
              onClick={() => setScope("agency")}
              style={{ padding: "6px 16px", borderRadius: 8, border: "1px solid var(--border)", background: scope === "agency" ? "var(--color-accent, #ffb800)" : "var(--bg-card)", color: scope === "agency" ? "#000" : "inherit", fontWeight: 600, fontSize: "0.82rem", cursor: "pointer" }}
            >Celá kancelář</button>
          </div>
        )}
      </div>

      {/* Shared analytics component — scoped by role */}
      <ScopedAnalytics
        key={scope}
        brokerId={scope === "broker" ? brokerId || undefined : undefined}
        agencyId={scope === "agency" ? agencyId || undefined : undefined}
      />

      {/* TIP stats — only for broker's own featured properties */}
      {tipStats.length > 0 && (
        <div style={{ marginTop: 20, background: "var(--bg-card)", borderRadius: 12, padding: "20px 24px", border: "1px solid var(--border)" }}>
          <div style={{ fontWeight: 600, marginBottom: 16, fontSize: "0.9rem" }}>{t.dashboard.tipStatsTitle}</div>
          <div style={{ overflowX: "auto" }}>
            <table className="admin-table" style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "8px 12px", borderBottom: "1px solid var(--border)", fontSize: 13, color: "var(--text-muted)" }}>{t.dashboard.listingNameLabel}</th>
                  <th style={{ textAlign: "center", padding: "8px 12px", borderBottom: "1px solid var(--border)", fontSize: 13, color: "var(--text-muted)" }}>{t.dashboard.tipImpressions}</th>
                  <th style={{ textAlign: "center", padding: "8px 12px", borderBottom: "1px solid var(--border)", fontSize: 13, color: "var(--text-muted)" }}>{t.dashboard.tipClicks}</th>
                  <th style={{ textAlign: "center", padding: "8px 12px", borderBottom: "1px solid var(--border)", fontSize: 13, color: "var(--text-muted)" }}>{t.dashboard.tipContacts}</th>
                  <th style={{ textAlign: "center", padding: "8px 12px", borderBottom: "1px solid var(--border)", fontSize: 13, color: "var(--text-muted)" }}>{t.dashboard.tipExpiresLabel}</th>
                </tr>
              </thead>
              <tbody>
                {tipStats.map((tip) => (
                  <tr key={tip.propertyId}>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)" }}>
                      <div style={{ fontWeight: 500 }}>{tip.title}</div>
                      {tip.city && <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{tip.city}</div>}
                    </td>
                    <td style={{ textAlign: "center", padding: "10px 12px", borderBottom: "1px solid var(--border)", fontSize: 18, fontWeight: 600 }}>
                      {tip.impressions7d}<div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 400 }}>{t.dashboard.last7days}</div>
                    </td>
                    <td style={{ textAlign: "center", padding: "10px 12px", borderBottom: "1px solid var(--border)", fontSize: 18, fontWeight: 600 }}>
                      {tip.clicks7d}<div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 400 }}>{t.dashboard.last7days}</div>
                    </td>
                    <td style={{ textAlign: "center", padding: "10px 12px", borderBottom: "1px solid var(--border)", fontSize: 18, fontWeight: 600 }}>{tip.contacts}</td>
                    <td style={{ textAlign: "center", padding: "10px 12px", borderBottom: "1px solid var(--border)" }}>{formatDate(tip.featuredUntil)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
