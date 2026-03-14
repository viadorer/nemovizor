"use client";

import { useCallback, useState } from "react";
import { DataTable, type Column } from "@/components/admin/data-table";
import { getBrowserSupabase } from "@/lib/supabase-browser";

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

const columns: Column<ScraperRun>[] = [
  {
    key: "started_at",
    label: "Spuštěno",
    render: (row) => new Date(row.started_at).toLocaleString("cs"),
  },
  { key: "source", label: "Zdroj" },
  {
    key: "status",
    label: "Status",
    render: (row) => (
      <span className={`admin-badge admin-badge--${row.status}`}>
        {row.status}
      </span>
    ),
  },
  {
    key: "total_scraped",
    label: "Staženo",
    render: (row) => row.total_scraped.toLocaleString("cs"),
  },
  {
    key: "total_inserted",
    label: "Vloženo",
    render: (row) => row.total_inserted.toLocaleString("cs"),
  },
  {
    key: "total_updated",
    label: "Aktualizováno",
    render: (row) => row.total_updated.toLocaleString("cs"),
  },
  {
    key: "total_errors",
    label: "Chyby",
    render: (row) => (
      <span style={{ color: row.total_errors > 0 ? "#ef4444" : "var(--text-muted)" }}>
        {row.total_errors}
      </span>
    ),
  },
  {
    key: "finished_at",
    label: "Doba",
    sortable: false,
    render: (row) => {
      if (!row.finished_at) return "Běží...";
      const ms = new Date(row.finished_at).getTime() - new Date(row.started_at).getTime();
      const mins = Math.floor(ms / 60000);
      const secs = Math.floor((ms % 60000) / 1000);
      return `${mins}m ${secs}s`;
    },
  },
];

export default function AdminScraperPage() {
  const [tableKey] = useState(0);

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
      <h1 className="dashboard-page-title">Scraper</h1>

      <div className="admin-stats" style={{ marginBottom: 24 }}>
        <div className="admin-stat-card">
          <div className="label">Status</div>
          <div className="value" style={{ fontSize: "1rem", color: "var(--text-secondary)" }}>
            Scraper se ovládá přes CLI
          </div>
          <div className="sub">
            Spuštění: node scripts/scrape-sreality.mjs
          </div>
        </div>
      </div>

      <DataTable<ScraperRun>
        key={tableKey}
        title="Historie běhů"
        columns={columns}
        fetchData={fetchData}
        rowKey={(row) => row.id}
        searchPlaceholder="Hledat..."
      />
    </div>
  );
}
