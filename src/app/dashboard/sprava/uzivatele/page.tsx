"use client";

import { useCallback, useState } from "react";
import { DataTable, type Column } from "@/components/admin/data-table";

type UserRow = {
  id: string;
  full_name: string;
  role: string;
  phone: string;
  preferred_city: string;
  notification_email: boolean;
  created_at: string;
};

const roleLabels: Record<string, string> = {
  user: "Uživatel",
  broker: "Makléř",
  admin: "Admin",
};

const columns: Column<UserRow>[] = [
  {
    key: "full_name",
    label: "Jméno",
    render: (row) => row.full_name || "Bez jména",
  },
  {
    key: "role",
    label: "Role",
    render: (row) => (
      <span className={`admin-badge admin-badge--${row.role}`}>
        {roleLabels[row.role] || row.role}
      </span>
    ),
  },
  { key: "phone", label: "Telefon", render: (row) => row.phone || "-" },
  { key: "preferred_city", label: "Město", render: (row) => row.preferred_city || "-" },
  {
    key: "created_at",
    label: "Registrace",
    render: (row) => new Date(row.created_at).toLocaleDateString("cs"),
  },
];

export default function AdminUsersPage() {
  const [tableKey, setTableKey] = useState(0);

  const fetchData = useCallback(async (params: { page: number; limit: number; search: string; sort: string; order: "asc" | "desc" }) => {
    const qs = new URLSearchParams({
      page: String(params.page),
      limit: String(params.limit),
      search: params.search,
    });
    const res = await fetch(`/api/admin/users?${qs}`);
    return res.json();
  }, []);

  async function handleRoleChange(user: UserRow, newRole: string) {
    await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: user.id, role: newRole }),
    });
    setTableKey((k) => k + 1);
  }

  return (
    <div className="dashboard-page">
      <DataTable<UserRow>
        key={tableKey}
        title="Uživatelé"
        columns={columns}
        fetchData={fetchData}
        rowKey={(row) => row.id}
        searchPlaceholder="Hledat podle jména..."
        rowActions={(row) => (
          <select
            className="admin-btn admin-btn--secondary admin-btn--sm"
            style={{ padding: "4px 8px", fontSize: "0.8rem" }}
            value={row.role}
            onChange={(e) => handleRoleChange(row, e.target.value)}
          >
            <option value="user">Uživatel</option>
            <option value="broker">Makléř</option>
            <option value="admin">Admin</option>
          </select>
        )}
      />
    </div>
  );
}
