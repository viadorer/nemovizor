"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { getFavoriteIds } from "@/lib/favorites";
import { getSearchHistory, type SearchHistoryEntry } from "@/lib/search-history";
import { getBrowserSupabase } from "@/lib/supabase-browser";
import { useT } from "@/i18n/provider";
import { brand } from "@/brands";

export default function DashboardPage() {
  const { user } = useAuth();
  const t = useT();
  const [favCount, setFavCount] = useState(0);
  const [savedCount, setSavedCount] = useState(0);
  const [recentSearches, setRecentSearches] = useState<SearchHistoryEntry[]>([]);

  useEffect(() => {
    if (!user) return;

    getFavoriteIds(user.id).then((ids) => setFavCount(ids.length));
    getSearchHistory(user.id, 5).then(setRecentSearches);

    const supabase = getBrowserSupabase();
    if (supabase) {
      supabase
        .from("saved_searches")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .then(({ count }) => setSavedCount(count ?? 0));
    }
  }, [user]);

  const displayName = user?.user_metadata?.full_name || user?.email || "";

  return (
    <div className="dashboard-page">
      <div className="dashboard-welcome">
        <h1>{t.dashboard.greeting}{displayName.split(" ")[0] || displayName}</h1>
        <p className="dashboard-welcome-sub">{t.dashboard.welcomeMessage.replace("{brandName}", brand.name)}</p>
      </div>

      <div className="dashboard-stats">
        <Link href="/dashboard/oblibene" className="dashboard-stat-card">
          <div className="dashboard-stat-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </div>
          <span className="dashboard-stat-value">{favCount}</span>
          <span className="dashboard-stat-label">{t.dashboard.favoritesCount}</span>
        </Link>

        <Link href="/dashboard/hledani" className="dashboard-stat-card">
          <div className="dashboard-stat-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <span className="dashboard-stat-value">{savedCount}</span>
          <span className="dashboard-stat-label">{t.dashboard.savedSearchesCount}</span>
        </Link>

        <Link href="/dashboard/historie" className="dashboard-stat-card">
          <div className="dashboard-stat-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <span className="dashboard-stat-value">{recentSearches.length}</span>
          <span className="dashboard-stat-label">{t.dashboard.recentSearchesCount}</span>
        </Link>
      </div>

      <div className="dashboard-actions">
        <Link href="/nabidky" className="dashboard-action-btn">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          {t.dashboard.browseListings}
        </Link>
        {brand.features.valuation && (
          <Link href="/oceneni" className="dashboard-action-btn dashboard-action-btn--secondary">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="4" y="2" width="16" height="20" rx="2" />
              <path d="M8 6h8" />
              <path d="M8 10h8" />
              <path d="M8 14h4" />
            </svg>
            {t.valuation.title}
          </Link>
        )}
      </div>
    </div>
  );
}
