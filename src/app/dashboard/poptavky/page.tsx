"use client";

import { useCallback, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { DataTable, type Column } from "@/components/admin/data-table";
import { getBrowserSupabase } from "@/lib/supabase-browser";
import { useT } from "@/i18n/provider";

type RequestRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  request_type: string;
  status: string;
  created_at: string;
};

export default function BrokerRequestsPage() {
  const { user } = useAuth();
  const t = useT();
  const [tableKey, setTableKey] = useState(0);

  const typeLabels: Record<string, string> = {
    info: t.dashboard.requestTypeInfo,
    viewing: t.dashboard.requestTypeViewing,
    offer: t.dashboard.requestTypeOffer,
    valuation: t.dashboard.requestTypeValuation,
  };

  const statusLabels: Record<string, string> = {
    new: t.dashboard.requestStatusNew,
    contacted: t.dashboard.requestStatusContacted,
    closed: t.dashboard.requestStatusClosed,
  };

  const columns: Column<RequestRow>[] = [
    {
      key: "name",
      label: t.dashboard.requestClientLabel,
      render: (row) => (
        <div>
          <div style={{ fontWeight: 600 }}>{row.name}</div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{row.email}</div>
        </div>
      ),
    },
    { key: "phone", label: t.dashboard.requestPhoneLabel, render: (row) => row.phone || "-" },
    {
      key: "request_type",
      label: t.dashboard.requestTypeLabel,
      render: (row) => typeLabels[row.request_type] || row.request_type,
    },
    {
      key: "status",
      label: t.dashboard.requestStatusLabel,
      render: (row) => (
        <span className={`admin-badge admin-badge--${row.status === "new" ? "running" : row.status === "contacted" ? "active" : "inactive"}`}>
          {statusLabels[row.status] || row.status}
        </span>
      ),
    },
    {
      key: "message",
      label: t.dashboard.requestMessageLabel,
      sortable: false,
      render: (row) => (
        <span style={{ maxWidth: 200, display: "inline-block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {row.message || "-"}
        </span>
      ),
    },
    {
      key: "created_at",
      label: t.dashboard.requestDateLabel,
      render: (row) => new Date(row.created_at).toLocaleDateString("cs"),
    },
  ];

  const fetchData = useCallback(async (params: { page: number; limit: number; search: string; sort: string; order: "asc" | "desc" }) => {
    const supabase = getBrowserSupabase();
    if (!supabase || !user) return { data: [], total: 0 };

    const { data: broker } = await supabase
      .from("brokers")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!broker) return { data: [], total: 0 };

    const offset = (params.page - 1) * params.limit;
    let query = supabase
      .from("contact_requests")
      .select("id, name, email, phone, message, request_type, status, created_at", { count: "exact" })
      .eq("broker_id", broker.id);

    if (params.search) {
      query = query.or(`name.ilike.%${params.search}%,email.ilike.%${params.search}%`);
    }

    const sortCol = params.sort || "created_at";
    query = query.order(sortCol, { ascending: params.order === "asc" }).range(offset, offset + params.limit - 1);

    const { data, count } = await query;
    return { data: data ?? [], total: count ?? 0 };
  }, [user]);

  async function handleStatusChange(row: RequestRow, newStatus: string) {
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    await supabase.from("contact_requests").update({
      status: newStatus,
      responded_at: newStatus === "contacted" ? new Date().toISOString() : undefined,
    }).eq("id", row.id);
    setTableKey((k) => k + 1);
  }

  return (
    <div className="dashboard-page">
      <DataTable<RequestRow>
        key={tableKey}
        title={t.dashboard.requestsTitle}
        columns={columns}
        fetchData={fetchData}
        rowKey={(row) => row.id}
        searchPlaceholder={t.dashboard.requestsSearchPlaceholder}
        rowActions={(row) => (
          <select
            className="admin-btn admin-btn--secondary admin-btn--sm"
            style={{ padding: "4px 8px", fontSize: "0.8rem" }}
            value={row.status}
            onChange={(e) => handleStatusChange(row, e.target.value)}
          >
            <option value="new">{t.dashboard.requestStatusNew}</option>
            <option value="contacted">{t.dashboard.requestStatusContacted}</option>
            <option value="closed">{t.dashboard.requestStatusClosed}</option>
          </select>
        )}
      />
    </div>
  );
}
