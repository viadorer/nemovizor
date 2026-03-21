"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { getBrowserSupabase } from "@/lib/supabase-browser";
import { useT } from "@/i18n/provider";

type TipStat = {
  propertyId: string;
  title: string;
  city: string;
  featuredUntil: string | null;
  impressions7d: number;
  clicks7d: number;
  contacts: number;
};

export default function BrokerAnalyticsPage() {
  const { user } = useAuth();
  const t = useT();
  const [stats, setStats] = useState<{
    totalListings: number;
    activeListings: number;
    totalRequests: number;
    newRequests: number;
  } | null>(null);
  const [tipStats, setTipStats] = useState<TipStat[]>([]);
  const [tipLoading, setTipLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const supabase = getBrowserSupabase();
    if (!supabase) return;

    (async () => {
      const { data: broker } = await supabase
        .from("brokers")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!broker) {
        setStats({ totalListings: 0, activeListings: 0, totalRequests: 0, newRequests: 0 });
        setTipLoading(false);
        return;
      }

      const [total, active, requests, newReqs] = await Promise.all([
        supabase.from("properties").select("id", { count: "exact", head: true }).eq("broker_id", broker.id),
        supabase.from("properties").select("id", { count: "exact", head: true }).eq("broker_id", broker.id).eq("active", true),
        supabase.from("contact_requests").select("id", { count: "exact", head: true }).eq("broker_id", broker.id),
        supabase.from("contact_requests").select("id", { count: "exact", head: true }).eq("broker_id", broker.id).eq("status", "new"),
      ]);

      setStats({
        totalListings: total.count ?? 0,
        activeListings: active.count ?? 0,
        totalRequests: requests.count ?? 0,
        newRequests: newReqs.count ?? 0,
      });

      // Fetch TIP stats for featured properties
      const { data: featuredProps } = await supabase
        .from("properties")
        .select("id, title, city, featured_until")
        .eq("broker_id", broker.id)
        .eq("featured", true)
        .eq("active", true);

      if (featuredProps && featuredProps.length > 0) {
        const propIds = featuredProps.map((p) => p.id);

        // Get 7-day views breakdown
        const { data: views7d } = await supabase
          .from("property_views")
          .select("property_id, view_type")
          .in("property_id", propIds)
          .gte("viewed_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

        // Get contact counts
        const { data: contacts } = await supabase
          .from("contact_requests")
          .select("property_id")
          .in("property_id", propIds);

        const tipData: TipStat[] = featuredProps.map((prop) => {
          const propViews = (views7d || []).filter((v) => v.property_id === prop.id);
          const propContacts = (contacts || []).filter((c) => c.property_id === prop.id);

          return {
            propertyId: prop.id,
            title: prop.title || prop.city || "—",
            city: prop.city || "",
            featuredUntil: prop.featured_until,
            impressions7d: propViews.filter((v) => v.view_type === "tip_impression").length,
            clicks7d: propViews.filter((v) => v.view_type === "detail_click").length,
            contacts: propContacts.length,
          };
        });

        setTipStats(tipData);
      }

      setTipLoading(false);
    })();
  }, [user]);

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("cs-CZ");
  };

  return (
    <div className="dashboard-page">
      <h1 className="dashboard-page-title">{t.dashboard.myAnalyticsTitle}</h1>

      {!stats ? (
        <p style={{ color: "var(--text-muted)" }}>{t.common.loading}</p>
      ) : (
        <>
          <div className="admin-stats">
            <div className="admin-stat-card">
              <div className="label">{t.dashboard.totalListings}</div>
              <div className="value">{stats.totalListings}</div>
              <div className="sub">{stats.activeListings} {t.dashboard.activeCount}</div>
            </div>
            <div className="admin-stat-card">
              <div className="label">{t.dashboard.totalRequests}</div>
              <div className="value">{stats.totalRequests}</div>
              <div className="sub">{stats.newRequests} {t.dashboard.newCount}</div>
            </div>
          </div>

          {/* TIP Stats Section */}
          <h2 style={{ fontSize: 18, fontWeight: 600, margin: "32px 0 16px" }}>{t.dashboard.tipStatsTitle}</h2>

          {tipLoading ? (
            <p style={{ color: "var(--text-muted)" }}>{t.common.loading}</p>
          ) : tipStats.length === 0 ? (
            <p style={{ color: "var(--text-muted)" }}>{t.dashboard.tipNoActive}</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="admin-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: "8px 12px", borderBottom: "1px solid #e0e0e0", fontSize: 13, color: "var(--text-muted)" }}>
                      Nabídka
                    </th>
                    <th style={{ textAlign: "center", padding: "8px 12px", borderBottom: "1px solid #e0e0e0", fontSize: 13, color: "var(--text-muted)" }}>
                      {t.dashboard.tipImpressions}
                    </th>
                    <th style={{ textAlign: "center", padding: "8px 12px", borderBottom: "1px solid #e0e0e0", fontSize: 13, color: "var(--text-muted)" }}>
                      {t.dashboard.tipClicks}
                    </th>
                    <th style={{ textAlign: "center", padding: "8px 12px", borderBottom: "1px solid #e0e0e0", fontSize: 13, color: "var(--text-muted)" }}>
                      {t.dashboard.tipContacts}
                    </th>
                    <th style={{ textAlign: "center", padding: "8px 12px", borderBottom: "1px solid #e0e0e0", fontSize: 13, color: "var(--text-muted)" }}>
                      {t.dashboard.tipExpiresLabel}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tipStats.map((tip) => (
                    <tr key={tip.propertyId}>
                      <td style={{ padding: "10px 12px", borderBottom: "1px solid #f0f0f0" }}>
                        <div style={{ fontWeight: 500 }}>{tip.title}</div>
                        {tip.city && <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{tip.city}</div>}
                      </td>
                      <td style={{ textAlign: "center", padding: "10px 12px", borderBottom: "1px solid #f0f0f0", fontSize: 18, fontWeight: 600 }}>
                        {tip.impressions7d}
                        <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 400 }}>{t.dashboard.last7days}</div>
                      </td>
                      <td style={{ textAlign: "center", padding: "10px 12px", borderBottom: "1px solid #f0f0f0", fontSize: 18, fontWeight: 600 }}>
                        {tip.clicks7d}
                        <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 400 }}>{t.dashboard.last7days}</div>
                      </td>
                      <td style={{ textAlign: "center", padding: "10px 12px", borderBottom: "1px solid #f0f0f0", fontSize: 18, fontWeight: 600 }}>
                        {tip.contacts}
                      </td>
                      <td style={{ textAlign: "center", padding: "10px 12px", borderBottom: "1px solid #f0f0f0" }}>
                        {formatDate(tip.featuredUntil)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
