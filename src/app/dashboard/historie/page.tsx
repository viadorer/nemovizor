"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { getSearchHistory, clearSearchHistory, type SearchHistoryEntry } from "@/lib/search-history";
import { generateSearchName, filtersToSearchParams, type SearchFilters } from "@/lib/saved-searches";

export default function HistoryPage() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<SearchHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    getSearchHistory(user.id).then((data) => {
      setEntries(data);
      setLoading(false);
    });
  }, [user]);

  async function handleClear() {
    if (!user) return;
    await clearSearchHistory(user.id);
    setEntries([]);
  }

  if (loading) {
    return (
      <div className="dashboard-page">
        <h1 className="dashboard-page-title">Historie hledani</h1>
        <p className="dashboard-loading">Nacitani...</p>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <div className="dashboard-page-header">
        <h1 className="dashboard-page-title">Historie hledani</h1>
        {entries.length > 0 && (
          <button type="button" className="dashboard-clear-btn" onClick={handleClear}>
            Smazat vse
          </button>
        )}
      </div>

      {entries.length === 0 ? (
        <div className="dashboard-empty">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <p>Zatim nemáte zadnou historii hledani</p>
          <Link href="/nabidky" className="dashboard-action-btn">Hledat nemovitosti</Link>
        </div>
      ) : (
        <div className="dashboard-history-list">
          {entries.map((entry) => {
            const filters = entry.filters as SearchFilters;
            const name = generateSearchName(filters, entry.location_label);
            const params = filtersToSearchParams(filters);
            return (
              <div key={entry.id} className="dashboard-history-item">
                <div className="dashboard-history-info">
                  <span className="dashboard-history-name">{name}</span>
                  <span className="dashboard-history-meta">
                    {new Date(entry.created_at).toLocaleString("cs-CZ", {
                      day: "numeric",
                      month: "numeric",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {entry.result_count != null && ` \u00B7 ${entry.result_count} vysledku`}
                  </span>
                </div>
                <Link href={`/nabidky?${params.toString()}`} className="dashboard-use-btn">
                  Zopakovat
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
