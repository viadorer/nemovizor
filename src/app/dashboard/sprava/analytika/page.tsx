"use client";

import { useEffect, useState } from "react";

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
        <h1 className="dashboard-page-title">Analytika</h1>
        <p style={{ color: "var(--text-muted)" }}>Načítání...</p>
      </div>
    );
  }

  if (!stats) return null;

  const cards = [
    { label: "Nemovitosti celkem", value: stats.properties, sub: `${stats.activeProperties} aktivních` },
    { label: "Projekty", value: stats.projects },
    { label: "Makléři", value: stats.brokers },
    { label: "Kanceláří", value: stats.agencies },
    { label: "Uživatelé", value: stats.users },
    { label: "Oblíbené", value: stats.favorites },
    { label: "Uložená hledání", value: stats.savedSearches },
  ];

  return (
    <div className="dashboard-page">
      <h1 className="dashboard-page-title">Analytika</h1>

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
