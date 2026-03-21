"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { getBrowserSupabase } from "@/lib/supabase-browser";
import { useT } from "@/i18n/provider";

type SavedSearchRow = {
  id: string;
  name: string;
  listing_type: string | null;
  category: string | null;
  subtype: string | null;
  city: string | null;
  price_min: number | null;
  price_max: number | null;
  area_min: number | null;
  area_max: number | null;
  notify_email: boolean;
  notify_frequency: string;
  active: boolean;
  created_at: string;
};

function buildSearchUrl(s: SavedSearchRow): string {
  const p = new URLSearchParams();
  if (s.listing_type) p.set("listingType", s.listing_type);
  if (s.category) p.set("category", s.category);
  if (s.subtype) p.set("subtype", s.subtype);
  if (s.city) p.set("city", s.city);
  if (s.price_min) p.set("priceMin", String(s.price_min));
  if (s.price_max) p.set("priceMax", String(s.price_max));
  if (s.area_min) p.set("areaMin", String(s.area_min));
  if (s.area_max) p.set("areaMax", String(s.area_max));
  return `/nabidky?${p.toString()}`;
}

export default function SavedSearchesPage() {
  const { user } = useAuth();
  const t = useT();
  const [searches, setSearches] = useState<SavedSearchRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const supabase = getBrowserSupabase();
    if (!supabase) return;

    supabase
      .from("saved_searches")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setSearches((data as SavedSearchRow[]) ?? []);
        setLoading(false);
      });
  }, [user]);

  async function handleDelete(id: string) {
    const supabase = getBrowserSupabase();
    if (!supabase || !user) return;
    await supabase.from("saved_searches").delete().eq("id", id).eq("user_id", user.id);
    setSearches((prev) => prev.filter((s) => s.id !== id));
  }

  async function toggleNotify(id: string, current: boolean) {
    const supabase = getBrowserSupabase();
    if (!supabase || !user) return;
    await supabase.from("saved_searches").update({ notify_email: !current }).eq("id", id);
    setSearches((prev) => prev.map((s) => s.id === id ? { ...s, notify_email: !current } : s));
  }

  if (loading) {
    return (
      <div className="dashboard-page">
        <h1 className="dashboard-page-title">{t.dashboard.savedSearchesTitle}</h1>
        <p className="dashboard-loading">{t.common.loading}</p>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <h1 className="dashboard-page-title">{t.dashboard.savedSearchesTitle}</h1>

      {searches.length === 0 ? (
        <div className="dashboard-empty">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
          </svg>
          <p>{t.dashboard.savedSearchesEmpty}</p>
          <Link href="/nabidky" className="dashboard-action-btn">{t.dashboard.searchProperties}</Link>
        </div>
      ) : (
        <div className="dashboard-searches-list">
          {searches.map((s) => (
            <div key={s.id} className="dashboard-search-item">
              <div className="dashboard-search-info">
                <span className="dashboard-search-name">{s.name}</span>
                <span className="dashboard-search-date">
                  {new Date(s.created_at).toLocaleDateString("cs-CZ")}
                </span>
              </div>
              <div className="dashboard-search-actions">
                <button
                  type="button"
                  className={`dashboard-notify-btn ${s.notify_email ? "dashboard-notify-btn--active" : ""}`}
                  onClick={() => toggleNotify(s.id, s.notify_email)}
                  title={s.notify_email ? t.dashboard.turnOffNotifications : t.dashboard.turnOnNotifications}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill={s.notify_email ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                </button>
                <Link href={buildSearchUrl(s)} className="dashboard-use-btn">
                  {t.dashboard.useSearch}
                </Link>
                <button
                  type="button"
                  className="dashboard-delete-btn"
                  onClick={() => handleDelete(s.id)}
                  title={t.common.delete}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
