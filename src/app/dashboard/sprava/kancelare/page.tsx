"use client";

import { useCallback, useState } from "react";
import { DataTable, type Column } from "@/components/admin/data-table";
import { getBrowserSupabase } from "@/lib/supabase-browser";

type AgencyRow = {
  id: string;
  name: string;
  slug: string;
  seat_city: string | null;
  email: string;
  phone: string;
  total_brokers: number;
  total_listings: number;
  rating: number | null;
};

const columns: Column<AgencyRow>[] = [
  {
    key: "name",
    label: "Název",
    render: (row) => (
      <div>
        <div style={{ fontWeight: 600 }}>{row.name}</div>
        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{row.seat_city || "-"}</div>
      </div>
    ),
  },
  { key: "email", label: "E-mail" },
  { key: "phone", label: "Telefon" },
  {
    key: "total_brokers",
    label: "Makléřů",
    render: (row) => String(row.total_brokers || 0),
  },
  {
    key: "total_listings",
    label: "Inzerátů",
    render: (row) => String(row.total_listings || 0),
  },
  {
    key: "rating",
    label: "Hodnocení",
    render: (row) => row.rating ? Number(row.rating).toFixed(1) : "-",
  },
];

export default function AdminAgenciesPage() {
  const fetchData = useCallback(async (params: { page: number; limit: number; search: string; sort: string; order: "asc" | "desc" }) => {
    const supabase = getBrowserSupabase();
    if (!supabase) return { data: [], total: 0 };

    const offset = (params.page - 1) * params.limit;
    let query = supabase
      .from("agencies")
      .select("id, name, slug, seat_city, email, phone, total_brokers, total_listings, rating", { count: "exact" });

    if (params.search) {
      query = query.or(`name.ilike.%${params.search}%,seat_city.ilike.%${params.search}%`);
    }

    const sortCol = params.sort || "name";
    query = query.order(sortCol, { ascending: params.order === "asc" }).range(offset, offset + params.limit - 1);

    const { data, count } = await query;
    return { data: data ?? [], total: count ?? 0 };
  }, []);

  return (
    <div className="dashboard-page">
      <DataTable<AgencyRow>
        title="Realitní kanceláře"
        columns={columns}
        fetchData={fetchData}
        rowKey={(row) => row.id}
        searchPlaceholder="Hledat podle názvu, města..."
      />
    </div>
  );
}
