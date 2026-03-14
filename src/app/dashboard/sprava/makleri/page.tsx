"use client";

import { useCallback, useState } from "react";
import { DataTable, type Column } from "@/components/admin/data-table";
import { getBrowserSupabase } from "@/lib/supabase-browser";

type BrokerRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  agency_name: string;
  rating: number | null;
  active_listings: number;
  specialization: string;
};

const columns: Column<BrokerRow>[] = [
  {
    key: "name",
    label: "Jméno",
    render: (row) => (
      <div>
        <div style={{ fontWeight: 600 }}>{row.name}</div>
        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{row.email}</div>
      </div>
    ),
  },
  { key: "phone", label: "Telefon" },
  { key: "agency_name", label: "Kancelář" },
  {
    key: "rating",
    label: "Hodnocení",
    render: (row) => row.rating ? Number(row.rating).toFixed(1) : "-",
  },
  {
    key: "active_listings",
    label: "Aktivní inzeráty",
    render: (row) => String(row.active_listings || 0),
  },
  {
    key: "specialization",
    label: "Specializace",
    render: (row) => row.specialization || "-",
  },
];

export default function AdminBrokersPage() {
  const [tableKey, setTableKey] = useState(0);

  const fetchData = useCallback(async (params: { page: number; limit: number; search: string; sort: string; order: "asc" | "desc" }) => {
    const supabase = getBrowserSupabase();
    if (!supabase) return { data: [], total: 0 };

    const offset = (params.page - 1) * params.limit;
    let query = supabase
      .from("brokers")
      .select("id, name, email, phone, agency_name, rating, active_listings, specialization", { count: "exact" });

    if (params.search) {
      query = query.or(`name.ilike.%${params.search}%,email.ilike.%${params.search}%,agency_name.ilike.%${params.search}%`);
    }

    const sortCol = params.sort || "name";
    query = query.order(sortCol, { ascending: params.order === "asc" }).range(offset, offset + params.limit - 1);

    const { data, count } = await query;
    return { data: data ?? [], total: count ?? 0 };
  }, []);

  return (
    <div className="dashboard-page">
      <DataTable<BrokerRow>
        key={tableKey}
        title="Makléři"
        columns={columns}
        fetchData={fetchData}
        rowKey={(row) => row.id}
        searchPlaceholder="Hledat podle jména, emailu, kanceláře..."
      />
    </div>
  );
}
