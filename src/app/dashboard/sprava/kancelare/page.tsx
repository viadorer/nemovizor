"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { DataTable, type Column } from "@/components/admin/data-table";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";

type AgencyRow = {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  seat_city: string | null;
  email: string;
  phone: string;
  total_brokers: number;
  total_listings: number;
  rating: number | null;
  website: string | null;
};

const columns: Column<AgencyRow>[] = [
  {
    key: "name",
    label: "Nazev",
    render: (row) => (
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {row.logo ? (
          <img src={row.logo} alt="" style={{ width: 32, height: 32, borderRadius: 6, objectFit: "cover" }} />
        ) : (
          <div style={{ width: 32, height: 32, borderRadius: 6, background: "var(--bg-muted, #f3f4f6)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontWeight: 600, fontSize: "0.75rem" }}>
            {row.name.charAt(0)}
          </div>
        )}
        <div>
          <div style={{ fontWeight: 600 }}>{row.name}</div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
            {row.seat_city || "-"}
          </div>
        </div>
      </div>
    ),
  },
  { key: "email", label: "E-mail" },
  { key: "phone", label: "Telefon" },
  {
    key: "total_brokers",
    label: "Makleru",
    render: (row) => String(row.total_brokers || 0),
  },
  {
    key: "total_listings",
    label: "Inzeratu",
    render: (row) => String(row.total_listings || 0),
  },
  {
    key: "rating",
    label: "Hodnoceni",
    render: (row) => (row.rating ? Number(row.rating).toFixed(1) : "-"),
  },
];

export default function AdminAgenciesPage() {
  const router = useRouter();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [tableKey, setTableKey] = useState(0);

  const fetchData = useCallback(
    async (params: {
      page: number;
      limit: number;
      search: string;
      sort: string;
      order: "asc" | "desc";
    }) => {
      const qs = new URLSearchParams({
        page: String(params.page),
        limit: String(params.limit),
        search: params.search,
        sort: params.sort,
        order: params.order,
      });
      const res = await fetch(`/api/admin/agencies?${qs}`);
      return res.json();
    },
    []
  );

  async function handleDelete() {
    if (!deleteId) return;
    await fetch(`/api/admin/agencies?id=${deleteId}`, { method: "DELETE" });
    setDeleteId(null);
    setTableKey((k) => k + 1);
  }

  return (
    <div className="dashboard-page">
      <DataTable<AgencyRow>
        key={tableKey}
        title="Realitni kancelare"
        columns={columns}
        fetchData={fetchData}
        rowKey={(row) => row.id}
        searchPlaceholder="Hledat podle nazvu, mesta..."
        onRowClick={(row) =>
          router.push(`/dashboard/sprava/kancelare/${row.id}/upravit`)
        }
        actions={
          <button
            className="admin-btn admin-btn--primary"
            onClick={() => router.push("/dashboard/sprava/kancelare/nova")}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            {"Nova kancelar"}
          </button>
        }
        rowActions={(row) => (
          <div style={{ display: "flex", gap: 4 }}>
            <button
              className="admin-btn admin-btn--secondary admin-btn--sm"
              onClick={() =>
                router.push(`/dashboard/sprava/kancelare/${row.id}/upravit`)
              }
              title="Upravit"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
            <button
              className="admin-btn admin-btn--secondary admin-btn--sm"
              onClick={() =>
                window.open(`/kancelare/${row.slug}`, "_blank")
              }
              title="Nahled"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </button>
            <button
              className="admin-btn admin-btn--danger admin-btn--sm"
              onClick={() => setDeleteId(row.id)}
              title="Archivovat"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
          </div>
        )}
      />

      <ConfirmDialog
        open={!!deleteId}
        title="Archivovat kancelar"
        message="Opravdu chcete tuto kancelar archivovat? Tuto akci nelze vratit."
        confirmLabel="Archivovat"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
