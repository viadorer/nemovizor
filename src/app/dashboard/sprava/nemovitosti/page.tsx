"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { DataTable, type Column } from "@/components/admin/data-table";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { useT } from "@/i18n/provider";
import { brand } from "@/brands";

type PropertyRow = {
  id: string;
  title: string;
  city: string;
  price: number;
  listing_type: string;
  category: string;
  active: boolean;
  featured: boolean;
  created_at: string;
  brokers: { name: string } | null;
};

export default function AdminPropertiesPage() {
  const t = useT();
  const router = useRouter();

  const columns: Column<PropertyRow>[] = [
    {
      key: "title",
      label: t.dashboard.adminPropertiesTitleCol,
      render: (row) => (
        <div>
          <div style={{ fontWeight: 600, maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {row.title || t.dashboard.adminPropertiesNoTitle}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
            {row.city}
          </div>
        </div>
      ),
    },
    {
      key: "price",
      label: t.dashboard.adminPropertiesPriceCol,
      render: (row) => row.price ? `${row.price.toLocaleString(brand.locale)} ${t.enumLabels.priceCurrencies.czk}` : "-",
    },
    {
      key: "listing_type",
      label: t.dashboard.adminPropertiesTypeCol,
      render: (row) => t.enumLabels.listingTypes[row.listing_type as keyof typeof t.enumLabels.listingTypes] || row.listing_type,
    },
    {
      key: "category",
      label: t.dashboard.adminPropertiesCategoryCol,
      render: (row) => t.enumLabels.propertyCategories[row.category as keyof typeof t.enumLabels.propertyCategories] || row.category,
    },
    {
      key: "active",
      label: t.dashboard.adminPropertiesStateCol,
      render: (row) => (
        <span className={`admin-badge ${row.active ? "admin-badge--active" : "admin-badge--inactive"}`}>
          {row.active ? t.dashboard.adminPropertiesStateActive : t.dashboard.adminPropertiesStateInactive}
        </span>
      ),
    },
    {
      key: "brokers",
      label: t.dashboard.adminPropertiesBrokerCol,
      sortable: false,
      render: (row) => row.brokers?.name || "-",
    },
  ];
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [tableKey, setTableKey] = useState(0);

  const fetchData = useCallback(async (params: { page: number; limit: number; search: string; sort: string; order: "asc" | "desc" }) => {
    const qs = new URLSearchParams({
      page: String(params.page),
      limit: String(params.limit),
      search: params.search,
      sort: params.sort,
      order: params.order,
    });
    const res = await fetch(`/api/admin/properties?${qs}`);
    return res.json();
  }, []);

  async function handleToggleActive(row: PropertyRow) {
    await fetch("/api/admin/properties", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: row.id, active: !row.active }),
    });
    setTableKey((k) => k + 1);
  }

  async function handleDelete() {
    if (!deleteId) return;
    await fetch(`/api/admin/properties?id=${deleteId}`, { method: "DELETE" });
    setDeleteId(null);
    setTableKey((k) => k + 1);
  }

  async function handleToggleFeatured(row: PropertyRow) {
    await fetch("/api/admin/properties", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: row.id, featured: !row.featured }),
    });
    setTableKey((k) => k + 1);
  }

  return (
    <div className="dashboard-page">
      <DataTable<PropertyRow>
        key={tableKey}
        title={t.dashboard.adminPropertiesTitle}
        columns={columns}
        fetchData={fetchData}
        rowKey={(row) => row.id}
        searchPlaceholder={t.dashboard.adminPropertiesSearch}
        onRowClick={(row) => router.push(`/dashboard/sprava/nemovitosti/${row.id}/upravit`)}
        actions={
          <button
            className="admin-btn admin-btn--primary"
            onClick={() => router.push("/dashboard/sprava/nemovitosti/novy")}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" />
            </svg>
            {t.dashboard.adminPropertiesNewBtn}
          </button>
        }
        rowActions={(row) => (
          <div style={{ display: "flex", gap: 4 }}>
            <button
              className="admin-btn admin-btn--secondary admin-btn--sm"
              onClick={() => router.push(`/dashboard/sprava/nemovitosti/${row.id}/upravit`)}
              title={t.common.edit}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
            <button
              className="admin-btn admin-btn--secondary admin-btn--sm"
              onClick={() => handleToggleActive(row)}
              title={row.active ? t.dashboard.adminPropertiesDeactivate : t.dashboard.adminPropertiesActivate }
            >
              {row.active ? t.dashboard.adminPropertiesHide : t.dashboard.adminPropertiesShow}
            </button>
            <button
              className="admin-btn admin-btn--secondary admin-btn--sm"
              onClick={() => handleToggleFeatured(row)}
              title={row.featured ? t.dashboard.adminPropertiesUnfeature : t.dashboard.adminPropertiesFeature}
            >
              {row.featured ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              )}
            </button>
            <button
              className="admin-btn admin-btn--danger admin-btn--sm"
              onClick={() => setDeleteId(row.id)}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
          </div>
        )}
      />

      <ConfirmDialog
        open={!!deleteId}
        title={t.dashboard.adminPropertiesDeleteTitle}
        message={t.dashboard.adminPropertiesDeleteMessage}
        confirmLabel={t.dashboard.adminPropertiesDeleteBtn}
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
