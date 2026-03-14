"use client";

import { useCallback, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { DataTable, type Column } from "@/components/admin/data-table";
import { getBrowserSupabase } from "@/lib/supabase-browser";

type PropertyRow = {
  id: string;
  title: string;
  city: string;
  price: number;
  listing_type: string;
  category: string;
  active: boolean;
  created_at: string;
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
        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{row.city}</div>
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
      const labels: Record<string, string> = { sale: "Prodej", rent: "Pronájem", auction: "Dražba" };
      return labels[row.listing_type] || row.listing_type;
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
    key: "created_at",
    label: "Vytvořeno",
    render: (row) => new Date(row.created_at).toLocaleDateString("cs"),
  },
];

export default function BrokerListingsPage() {
  const { user } = useAuth();
  const [tableKey] = useState(0);

  const fetchData = useCallback(async (params: { page: number; limit: number; search: string; sort: string; order: "asc" | "desc" }) => {
    const supabase = getBrowserSupabase();
    if (!supabase || !user) return { data: [], total: 0 };

    // Find broker record linked to this user
    const { data: broker } = await supabase
      .from("brokers")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!broker) return { data: [], total: 0 };

    const offset = (params.page - 1) * params.limit;
    let query = supabase
      .from("properties")
      .select("id, title, city, price, listing_type, category, active, created_at", { count: "exact" })
      .eq("broker_id", broker.id);

    if (params.search) {
      query = query.or(`title.ilike.%${params.search}%,city.ilike.%${params.search}%`);
    }

    const sortCol = params.sort || "created_at";
    query = query.order(sortCol, { ascending: params.order === "asc" }).range(offset, offset + params.limit - 1);

    const { data, count } = await query;
    return { data: data ?? [], total: count ?? 0 };
  }, [user]);

  return (
    <div className="dashboard-page">
      <DataTable<PropertyRow>
        key={tableKey}
        title="Moje inzeráty"
        columns={columns}
        fetchData={fetchData}
        rowKey={(row) => row.id}
        searchPlaceholder="Hledat podle názvu, města..."
      />
    </div>
  );
}
