"use client";

import { useEffect, useState } from "react";
import { useT } from "@/i18n/provider";

type Stats = {
  properties: number;
  activeProperties: number;
  brokers: number;
  agencies: number;
  users: number;
  favorites: number;
  savedSearches: number;
  projects: number;
};

export default function AdminAnalyticsPage() {
  const t = useT();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/analytics")
      .then((r) => r.json())
      .then(setStats)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="dashboard-page">
        <h1 className="dashboard-page-title">{t.dashboard.adminAnalyticsTitle}</h1>
        <p style={{ color: "var(--text-muted)" }}>{t.common.loading}</p>
      </div>
    );
  }

  if (!stats) return null;

  const cards = [
    { label: t.dashboard.adminTotalProperties, value: stats.properties, sub: `${stats.activeProperties} ${t.dashboard.activeCount}` },
    { label: t.dashboard.adminProjects, value: stats.projects },
    { label: t.dashboard.adminBrokersLabel, value: stats.brokers },
    { label: t.dashboard.adminAgenciesLabel, value: stats.agencies },
    { label: t.dashboard.adminUsersLabel, value: stats.users },
    { label: t.dashboard.adminFavorites, value: stats.favorites },
    { label: t.dashboard.adminSavedSearches, value: stats.savedSearches },
  ];

  return (
    <div className="dashboard-page">
      <h1 className="dashboard-page-title">{t.dashboard.adminAnalyticsTitle}</h1>

      <div className="admin-stats">
        {cards.map((card) => (
          <div key={card.label} className="admin-stat-card">
            <div className="label">{card.label}</div>
            <div className="value">{card.value.toLocaleString("cs")}</div>
            {card.sub && <div className="sub">{card.sub}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
