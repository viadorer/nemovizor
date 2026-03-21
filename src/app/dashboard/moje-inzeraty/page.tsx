"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { DataTable, type Column } from "@/components/admin/data-table";
import { getBrowserSupabase } from "@/lib/supabase-browser";
import { useT } from "@/i18n/provider";

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

export default function BrokerListingsPage() {
  const { user } = useAuth();
  const t = useT();
  const router = useRouter();
  const [tableKey, setTableKey] = useState(0);

  const columns: Column<PropertyRow>[] = [
    {
      key: "title",
      label: t.dashboard.listingNameLabel,
      render: (row) => (
        <div>
          <div style={{ fontWeight: 600, maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {row.title || t.dashboard.listingNoTitle}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{row.city}</div>
        </div>
      ),
    },
    {
      key: "price",
      label: t.dashboard.listingPriceLabel,
      render: (row) => row.price ? `${row.price.toLocaleString("cs")} Kč` : "-",
    },
    {
      key: "listing_type",
      label: t.dashboard.listingTypeLabel,
      render: (row) => {
        return t.enumLabels.listingTypes[row.listing_type] || row.listing_type;
      },
    },
    {
      key: "active",
      label: t.dashboard.listingStateLabel,
      render: (row) => (
        <span className={`admin-badge ${row.active ? "admin-badge--active" : "admin-badge--inactive"}`}>
          {row.active ? t.dashboard.listingStateActive : t.dashboard.listingStateInactive}
        </span>
      ),
    },
    {
      key: "created_at",
      label: t.dashboard.listingCreatedLabel,
      render: (row) => new Date(row.created_at).toLocaleDateString("cs"),
    },
  ];

  const fetchData = useCallback(async (params: { page: number; limit: number; search: string; sort: string; order: "asc" | "desc" }) => {
    const supabase = getBrowserSupabase();
    if (!supabase || !user) return { data: [], total: 0 };

    // Collect broker IDs the user can manage:
    // 1) User is a broker → own record + agency team
    // 2) User owns an agency → all brokers in that agency
    const brokerIds: string[] = [];

    const { data: myBroker } = await supabase
      .from("brokers")
      .select("id, agency_id")
      .eq("user_id", user.id)
      .single();

    const { data: myAgency } = await supabase
      .from("agencies")
      .select("id")
      .eq("user_id", user.id)
      .single();

    const agencyId = myAgency?.id || myBroker?.agency_id || null;

    if (agencyId) {
      // Load all brokers in the agency
      const { data: teamBrokers } = await supabase
        .from("brokers")
        .select("id")
        .eq("agency_id", agencyId);
      if (teamBrokers) {
        for (const b of teamBrokers) brokerIds.push(b.id);
      }
    } else if (myBroker) {
      brokerIds.push(myBroker.id);
    }

    if (brokerIds.length === 0 && !user) return { data: [], total: 0 };

    const offset = (params.page - 1) * params.limit;

    // Build filter: broker's properties OR properties created by this user
    const filters: string[] = [];
    if (brokerIds.length > 0) {
      filters.push(`broker_id.in.(${brokerIds.join(",")})`);
    }
    filters.push(`created_by.eq.${user.id}`);

    let query = supabase
      .from("properties")
      .select("id, title, city, price, listing_type, category, active, created_at", { count: "exact" })
      .or(filters.join(","));

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
        title={t.dashboard.myListingsTitle}
        columns={columns}
        fetchData={fetchData}
        rowKey={(row) => row.id}
        searchPlaceholder={t.dashboard.myListingsSearchPlaceholder}
        onRowClick={(row) => router.push(`/dashboard/moje-inzeraty/${row.id}/upravit`)}
        actions={
          <button
            className="admin-btn admin-btn--primary"
            onClick={() => router.push("/dashboard/moje-inzeraty/novy")}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            {t.dashboard.newProperty}
          </button>
        }
      />
    </div>
  );
}
