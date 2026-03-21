"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { DataTable, type Column } from "@/components/admin/data-table";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { useT } from "@/i18n/provider";

type BrokerRow = {
  id: string;
  name: string;
  slug: string;
  photo: string | null;
  email: string;
  phone: string;
  agency_name: string;
  agencies: { name: string } | null;
  rating: number | null;
  active_listings: number;
  specialization: string;
  user_id: string;
};

export default function AdminBrokersPage() {
  const t = useT();
  const router = useRouter();

  const columns: Column<BrokerRow>[] = [
    {
      key: "name",
      label: t.dashboard.adminBrokersNameCol,
      render: (row) => (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {row.photo ? (
            <img src={row.photo} alt="" style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover" }} />
          ) : (
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--bg-muted, #f3f4f6)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontWeight: 600, fontSize: "0.75rem" }}>
              {row.name.charAt(0)}
            </div>
          )}
          <div>
            <div style={{ fontWeight: 600 }}>{row.name}</div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{row.email}</div>
          </div>
        </div>
      ),
    },
    { key: "phone", label: t.dashboard.adminBrokersPhoneCol },
    {
      key: "agency_name",
      label: t.dashboard.adminBrokersAgencyCol,
      sortable: false,
      render: (row) => row.agencies?.name || row.agency_name || "-",
    },
    {
      key: "rating",
      label: t.dashboard.adminBrokersRatingCol,
      render: (row) => (row.rating ? Number(row.rating).toFixed(1) : "-"),
    },
    {
      key: "active_listings",
      label: t.dashboard.adminBrokersActiveListingsCol,
      render: (row) => String(row.active_listings || 0),
    },
    {
      key: "specialization",
      label: t.dashboard.adminBrokersSpecCol,
      render: (row) => row.specialization || "-",
    },
  ];
  const [archiveId, setArchiveId] = useState<string | null>(null);
  const [tableKey, setTableKey] = useState(0);

  const fetchData = useCallback(async (params: { page: number; limit: number; search: string; sort: string; order: "asc" | "desc" }) => {
    const qs = new URLSearchParams({
      page: String(params.page),
      limit: String(params.limit),
      search: params.search,
      sort: params.sort,
      order: params.order,
    });
    const res = await fetch(`/api/admin/brokers?${qs}`);
    return res.json();
  }, []);

  async function handleArchive() {
    if (!archiveId) return;
    await fetch(`/api/admin/brokers?id=${archiveId}`, { method: "DELETE" });
    setArchiveId(null);
    setTableKey((k) => k + 1);
  }

  return (
    <div className="dashboard-page">
      <DataTable<BrokerRow>
        key={tableKey}
        title={t.dashboard.adminBrokersTitle}
        columns={columns}
        fetchData={fetchData}
        rowKey={(row) => row.id}
        searchPlaceholder={t.dashboard.adminBrokersSearch}
        onRowClick={(row) => router.push(`/dashboard/sprava/makleri/${row.id}/upravit`)}
        actions={
          <button
            className="admin-btn admin-btn--primary"
            onClick={() => router.push("/dashboard/sprava/makleri/novy")}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" />
            </svg>
            {t.dashboard.adminBrokersNewBtn}
          </button>
        }
        rowActions={(row) => (
          <div style={{ display: "flex", gap: 4 }}>
            <button
              className="admin-btn admin-btn--secondary admin-btn--sm"
              onClick={() => router.push(`/dashboard/sprava/makleri/${row.id}/upravit`)}
              title={t.common.edit}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
            <button
              className="admin-btn admin-btn--danger admin-btn--sm"
              onClick={() => setArchiveId(row.id)}
              title={t.dashboard.adminBrokersArchiveBtn}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="21 8 21 21 3 21 3 8" />
                <rect x="1" y="3" width="22" height="5" />
                <line x1="10" y1="12" x2="14" y2="12" />
              </svg>
            </button>
            <button
              className="admin-btn admin-btn--secondary admin-btn--sm"
              onClick={() => window.open(`/makleri/${row.slug}`, "_blank")}
              title={t.header.detail}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </button>
          </div>
        )}
      />

      <ConfirmDialog
        open={!!archiveId}
        title={t.dashboard.adminBrokersArchiveTitle}
        message={t.dashboard.adminBrokersArchiveMessage}
        confirmLabel={t.dashboard.adminBrokersArchiveBtn}
        danger
        onConfirm={handleArchive}
        onCancel={() => setArchiveId(null)}
      />
    </div>
  );
}
