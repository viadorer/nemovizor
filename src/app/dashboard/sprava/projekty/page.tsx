"use client";

import { useCallback, useState } from "react";
import { DataTable, type Column } from "@/components/admin/data-table";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { useT } from "@/i18n/provider";

type ProjectRow = {
  id: string;
  name: string;
  slug: string;
  city: string;
  developer_name: string;
  status: string;
  total_units: number;
  available_units: number;
  price_from: number | null;
  price_to: number | null;
  active: boolean;
  created_at: string;
};

export default function AdminProjectsPage() {
  const t = useT();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [tableKey, setTableKey] = useState(0);

  const statusLabels: Record<string, string> = {
    planned: t.dashboard.projectStatusPlanned,
    active: t.dashboard.projectStatusActive,
    construction: t.dashboard.projectStatusConstruction,
    selling: t.dashboard.projectStatusSelling,
    completed: t.dashboard.projectStatusCompleted,
    archived: t.dashboard.projectStatusArchived,
  };

  const columns: Column<ProjectRow>[] = [
    {
      key: "name",
      label: t.dashboard.projectNameLabel,
      render: (row) => (
        <div>
          <div style={{ fontWeight: 600 }}>{row.name}</div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{row.developer_name}</div>
        </div>
      ),
    },
    { key: "city", label: t.dashboard.projectCityLabel },
    {
      key: "status",
      label: t.dashboard.projectStatusLabel,
      render: (row) => (
        <span className={`admin-badge admin-badge--${row.status === "active" || row.status === "selling" ? "active" : row.status === "archived" ? "inactive" : "running"}`}>
          {statusLabels[row.status] || row.status}
        </span>
      ),
    },
    {
      key: "total_units",
      label: t.dashboard.projectUnitsLabel,
      render: (row) => `${row.available_units} / ${row.total_units}`,
    },
    {
      key: "price_from",
      label: t.dashboard.projectPriceFromLabel,
      render: (row) => row.price_from ? `${Number(row.price_from).toLocaleString("cs")} Kč` : "-",
    },
    {
      key: "active",
      label: t.dashboard.projectStateLabel,
      render: (row) => (
        <span className={`admin-badge ${row.active ? "admin-badge--active" : "admin-badge--inactive"}`}>
          {row.active ? t.dashboard.listingStateActive : t.dashboard.listingStateInactive}
        </span>
      ),
    },
  ];

  const fetchData = useCallback(async (params: { page: number; limit: number; search: string; sort: string; order: "asc" | "desc" }) => {
    const qs = new URLSearchParams({
      page: String(params.page),
      limit: String(params.limit),
      search: params.search,
      sort: params.sort,
      order: params.order,
    });
    const res = await fetch(`/api/admin/projects?${qs}`);
    if (!res.ok) return { data: [], total: 0 };
    return res.json();
  }, []);

  async function handleDelete() {
    if (!deleteId) return;
    await fetch(`/api/admin/projects?id=${deleteId}`, { method: "DELETE" });
    setDeleteId(null);
    setTableKey((k) => k + 1);
  }

  return (
    <div className="dashboard-page">
      <DataTable<ProjectRow>
        key={tableKey}
        title={t.dashboard.adminProjectsTitle}
        columns={columns}
        fetchData={fetchData}
        rowKey={(row) => row.id}
        searchPlaceholder={t.dashboard.adminProjectsSearchPlaceholder}
        rowActions={(row) => (
          <div style={{ display: "flex", gap: 4 }}>
            <button
              className="admin-btn admin-btn--danger admin-btn--sm"
              onClick={() => setDeleteId(row.id)}
            >
              {t.dashboard.projectDeleteBtn}
            </button>
          </div>
        )}
      />

      <ConfirmDialog
        open={!!deleteId}
        title={t.dashboard.projectDeleteTitle}
        message={t.dashboard.projectDeleteMessage}
        confirmLabel={t.dashboard.projectDeleteBtn}
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
