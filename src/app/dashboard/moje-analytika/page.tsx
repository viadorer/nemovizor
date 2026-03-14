"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { getBrowserSupabase } from "@/lib/supabase-browser";

export default function BrokerAnalyticsPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<{
    totalListings: number;
    activeListings: number;
    totalRequests: number;
    newRequests: number;
  } | null>(null);

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
    })();
  }, [user]);

  return (
    <div className="dashboard-page">
      <h1 className="dashboard-page-title">Moje analytika</h1>

      {!stats ? (
        <p style={{ color: "var(--text-muted)" }}>Načítání...</p>
      ) : (
        <div className="admin-stats">
          <div className="admin-stat-card">
            <div className="label">Inzeraty celkem</div>
            <div className="value">{stats.totalListings}</div>
            <div className="sub">{stats.activeListings} aktivních</div>
          </div>
          <div className="admin-stat-card">
            <div className="label">Poptávky celkem</div>
            <div className="value">{stats.totalRequests}</div>
            <div className="sub">{stats.newRequests} nových</div>
          </div>
        </div>
      )}
    </div>
  );
}
