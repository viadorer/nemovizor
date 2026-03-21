"use client";

import { useCallback, useState } from "react";
import { DataTable, type Column } from "@/components/admin/data-table";
import { getBrowserSupabase } from "@/lib/supabase-browser";
import { useT } from "@/i18n/provider";

type ScraperRun = {
  id: string;
  source: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  total_scraped: number;
  total_inserted: number;
  total_updated: number;
  total_errors: number;
};

export default function AdminScraperPage() {
  const t = useT();
  const [tableKey] = useState(0);

  const columns: Column<ScraperRun>[] = [
    {
      key: "started_at",
      label: t.dashboard.scraperStartedAt,
      render: (row) => new Date(row.started_at).toLocaleString("cs"),
    },
    { key: "source", label: t.dashboard.scraperSource },
    {
      key: "status",
      label: t.dashboard.scraperStatus,
      render: (row) => (
        <span className={`admin-badge admin-badge--${row.status}`}>
          {row.status}
        </span>
      ),
    },
    {
      key: "total_scraped",
      label: t.dashboard.scraperScraped,
      render: (row) => row.total_scraped.toLocaleString("cs"),
    },
    {
      key: "total_inserted",
      label: t.dashboard.scraperInserted,
      render: (row) => row.total_inserted.toLocaleString("cs"),
    },
    {
      key: "total_updated",
      label: t.dashboard.scraperUpdated,
      render: (row) => row.total_updated.toLocaleString("cs"),
    },
    {
      key: "total_errors",
      label: t.dashboard.scraperErrors,
      render: (row) => (
        <span style={{ color: row.total_errors > 0 ? "#ef4444" : "var(--text-muted)" }}>
          {row.total_errors}
        </span>
      ),
    },
    {
      key: "finished_at",
      label: t.dashboard.scraperDuration,
      sortable: false,
      render: (row) => {
        if (!row.finished_at) return t.dashboard.scraperRunning;
        const ms = new Date(row.finished_at).getTime() - new Date(row.started_at).getTime();
        const mins = Math.floor(ms / 60000);
        const secs = Math.floor((ms % 60000) / 1000);
        return `${mins}m ${secs}s`;
      },
    },
  ];

  const fetchData = useCallback(async (params: { page: number; limit: number; search: string; sort: string; order: "asc" | "desc" }) => {
    const supabase = getBrowserSupabase();
    if (!supabase) return { data: [], total: 0 };

    const offset = (params.page - 1) * params.limit;
    const sortCol = params.sort || "started_at";

    const { data, count } = await supabase
      .from("scraper_runs")
      .select("*", { count: "exact" })
      .order(sortCol, { ascending: params.order === "asc" })
      .range(offset, offset + params.limit - 1);

    return { data: data ?? [], total: count ?? 0 };
  }, []);

  return (
    <div className="dashboard-page">
      <h1 className="dashboard-page-title">{t.dashboard.scraperTitle}</h1>

      <div className="admin-stats" style={{ marginBottom: 24 }}>
        <div className="admin-stat-card">
          <div className="label">{t.dashboard.scraperStatusLabel}</div>
          <div className="value" style={{ fontSize: "1rem", color: "var(--text-secondary)" }}>
            {t.dashboard.scraperCliMessage}
          </div>
          <div className="sub">
            {t.dashboard.scraperRunCommand}
          </div>
        </div>
      </div>

      <DataTable<ScraperRun>
        key={tableKey}
        title={t.dashboard.scraperRunHistoryTitle}
        columns={columns}
        fetchData={fetchData}
        rowKey={(row) => row.id}
        searchPlaceholder={t.dashboard.scraperSearchPlaceholder}
      />
    </div>
  );
}
