"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { DataTable, type Column } from "@/components/admin/data-table";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";

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

const columns: Column<PropertyRow>[] = [
  {
    key: "title",
    label: "Název",
    render: (row) => (
      <div>
        <div style={{ fontWeight: 600, maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {row.title || "Bez názvu"}
        </div>
        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
          {row.city}
        </div>
      </div>
    ),
  },
  {
    key: "price",
    label: "Cena",
    render: (row) => row.price ? `${row.price.toLocaleString("cs")} Kč` : "-",
  },
  {
    key: "listing_type",
    label: "Typ",
    render: (row) => {
      const labels: Record<string, string> = { sale: "Prodej", rent: "Pronájem", auction: "Dražba", project: "Projekt" };
      return labels[row.listing_type] || row.listing_type;
    },
  },
  {
    key: "category",
    label: "Kategorie",
    render: (row) => {
      const labels: Record<string, string> = { apartment: "Byt", house: "Dům", land: "Pozemek", commercial: "Komerční", other: "Ostatní" };
      return labels[row.category] || row.category;
    },
  },
  {
    key: "active",
    label: "Stav",
    render: (row) => (
      <span className={`admin-badge ${row.active ? "admin-badge--active" : "admin-badge--inactive"}`}>
        {row.active ? "Aktivní" : "Neaktivní"}
      </span>
    ),
  },
  {
    key: "brokers",
    label: "Makléř",
    sortable: false,
    render: (row) => row.brokers?.name || "-",
  },
];

export default function AdminPropertiesPage() {
  const router = useRouter();
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
        title="Nemovitosti"
        columns={columns}
        fetchData={fetchData}
        rowKey={(row) => row.id}
        searchPlaceholder="Hledat podle názvu, města..."
        onRowClick={(row) => router.push(`/nemovitost/${row.id}`)}
        rowActions={(row) => (
          <div style={{ display: "flex", gap: 4 }}>
            <button
              className="admin-btn admin-btn--secondary admin-btn--sm"
              onClick={() => handleToggleActive(row)}
              title={row.active ? "Deaktivovat" : "Aktivovat"}
            >
              {row.active ? "Skrýt" : "Zobrazit"}
            </button>
            <button
              className="admin-btn admin-btn--secondary admin-btn--sm"
              onClick={() => handleToggleFeatured(row)}
              title={row.featured ? "Odebrat z doporučený" : "Doporučit"}
            >
              {row.featured ? "★" : "☆"}
            </button>
            <button
              className="admin-btn admin-btn--danger admin-btn--sm"
              onClick={() => setDeleteId(row.id)}
            >
              Smazat
            </button>
          </div>
        )}
      />

      <ConfirmDialog
        open={!!deleteId}
        title="Smazat nemovitost"
        message="Opravdu chcete tuto nemovitost smazat? Tuto akci nelze vrátit."
        confirmLabel="Smazat"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
