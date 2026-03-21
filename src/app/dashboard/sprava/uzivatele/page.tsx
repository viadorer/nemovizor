"use client";

import { useCallback, useState } from "react";
import { DataTable, type Column } from "@/components/admin/data-table";
import { useT } from "@/i18n/provider";
import { brand } from "@/brands";

type UserRow = {
  id: string;
  full_name: string;
  role: string;
  phone: string;
  preferred_city: string;
  notification_email: boolean;
  created_at: string;
};

type AccountPreview = {
  agencies: { total: number; with_account: number; need_account: number };
  brokers: { total: number; with_account: number; need_account: number };
};

type AccountResult = {
  created: { agencies: number; brokers: number };
  skipped: { agencies_no_email: number; agencies_has_account: number; brokers_no_email: number; brokers_has_account: number; duplicate_email: number };
  errors: string[];
};

export default function AdminUsersPage() {
  const t = useT();

  const roleLabels: Record<string, string> = {
    user: t.dashboard.adminUsersRoleUser,
    broker: t.dashboard.adminUsersRoleBroker,
    admin: t.dashboard.adminUsersRoleAdmin,
  };

  const columns: Column<UserRow>[] = [
    {
      key: "full_name",
      label: t.dashboard.adminUsersNameCol,
      render: (row) => row.full_name || t.dashboard.adminUsersNoName,
    },
    {
      key: "role",
      label: t.dashboard.adminUsersRoleCol,
      render: (row) => (
        <span className={`admin-badge admin-badge--${row.role}`}>
          {roleLabels[row.role] || row.role}
        </span>
      ),
    },
    { key: "phone", label: t.dashboard.adminUsersPhoneCol, render: (row) => row.phone || "-" },
    { key: "preferred_city", label: t.dashboard.adminUsersCityCol, render: (row) => row.preferred_city || "-" },
    {
      key: "created_at",
      label: t.dashboard.adminUsersRegisteredCol,
      render: (row) => new Date(row.created_at).toLocaleDateString(brand.locale),
    },
  ];
  const [tableKey, setTableKey] = useState(0);
  const [preview, setPreview] = useState<AccountPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<AccountResult | null>(null);

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

  async function loadPreview() {
    setPreviewLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/create-accounts");
      if (res.ok) {
        setPreview(await res.json());
      }
    } catch {
      // ignore
    } finally {
      setPreviewLoading(false);
    }
  }

  async function createAccounts() {
    setCreating(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/create-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: "all" }),
      });
      if (res.ok) {
        const data: AccountResult = await res.json();
        setResult(data);
        setPreview(null);
        setTableKey((k) => k + 1);
      }
    } catch {
      // ignore
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="dashboard-page">
      <DataTable<UserRow>
        key={tableKey}
        title={t.dashboard.adminUsersTitle}
        columns={columns}
        fetchData={fetchData}
        rowKey={(row) => row.id}
        searchPlaceholder={t.dashboard.adminUsersSearch}
        rowActions={(row) => (
          <select
            className="admin-btn admin-btn--secondary admin-btn--sm"
            style={{ padding: "4px 8px", fontSize: "0.8rem" }}
            value={row.role}
            onChange={(e) => handleRoleChange(row, e.target.value)}
          >
            <option value="user">{t.dashboard.adminUsersRoleUser}</option>
            <option value="broker">{t.dashboard.adminUsersRoleBroker}</option>
            <option value="admin">{t.dashboard.adminUsersRoleAdmin}</option>
          </select>
        )}
      />

      {/* Account creation section */}
      <div className="admin-section" style={{ marginTop: 32 }}>
        <h3 className="admin-section-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          {t.dashboard.adminUsersCreateAccountsTitle}
        </h3>
        <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: 16 }}>
          {t.dashboard.adminUsersCreateAccountsDesc}
        </p>

        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <button
            className="admin-btn admin-btn--secondary"
            onClick={loadPreview}
            disabled={previewLoading}
          >
            {previewLoading ? (
              <span className="pf-spinner-sm" />
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
            {t.dashboard.adminUsersShowPreview}
          </button>

          {preview && (
            <button
              className="admin-btn admin-btn--primary"
              onClick={createAccounts}
              disabled={creating || (preview.agencies.need_account === 0 && preview.brokers.need_account === 0)}
            >
              {creating ? (
                <span className="pf-spinner-sm" />
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <line x1="19" y1="8" x2="19" y2="14" />
                  <line x1="22" y1="11" x2="16" y2="11" />
                </svg>
              )}
              {t.dashboard.adminUsersCreateBtn.replace("{count}", String(preview.agencies.need_account + preview.brokers.need_account))}
            </button>
          )}
        </div>

        {/* Preview stats */}
        {preview && (
          <div className="pf-account-preview" style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div className="admin-card" style={{ padding: 16 }}>
              <h4 style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: 8 }}>{t.dashboard.adminUsersAgencies}</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.85rem" }}>
                <span>{t.dashboard.adminUsersTotal}<strong>{preview.agencies.total}</strong></span>
                <span>{t.dashboard.adminUsersWithAccount}<strong>{preview.agencies.with_account}</strong></span>
                <span style={{ color: preview.agencies.need_account > 0 ? "var(--accent)" : "var(--text-muted)" }}>
                  {t.dashboard.adminUsersToCreate}<strong>{preview.agencies.need_account}</strong>
                </span>
              </div>
            </div>
            <div className="admin-card" style={{ padding: 16 }}>
              <h4 style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: 8 }}>{t.dashboard.adminUsersBrokers}</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.85rem" }}>
                <span>{t.dashboard.adminUsersTotal}<strong>{preview.brokers.total}</strong></span>
                <span>{t.dashboard.adminUsersWithAccount}<strong>{preview.brokers.with_account}</strong></span>
                <span style={{ color: preview.brokers.need_account > 0 ? "var(--accent)" : "var(--text-muted)" }}>
                  {t.dashboard.adminUsersToCreate}<strong>{preview.brokers.need_account}</strong>
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Result */}
        {result && (
          <div style={{ marginTop: 16 }}>
            <div className="admin-card" style={{ padding: 16, background: result.errors.length > 0 ? "var(--bg-error)" : "var(--bg-success, #f0fdf4)" }}>
              <h4 style={{ fontSize: "0.9rem", marginBottom: 8 }}>{t.dashboard.adminUsersResult}</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.85rem" }}>
                {result.created.agencies > 0 && (
                  <span>{t.dashboard.adminUsersCreatedAgencyAccounts}<strong>{result.created.agencies}</strong></span>
                )}
                {result.created.brokers > 0 && (
                  <span>{t.dashboard.adminUsersCreatedBrokerAccounts}<strong>{result.created.brokers}</strong></span>
                )}
                {result.skipped.duplicate_email > 0 && (
                  <span style={{ color: "var(--text-muted)" }}>{t.dashboard.adminUsersSkippedDuplicate}<strong>{result.skipped.duplicate_email}</strong></span>
                )}
                {result.skipped.agencies_no_email > 0 && (
                  <span style={{ color: "var(--text-muted)" }}>{t.dashboard.adminUsersAgenciesNoEmail}<strong>{result.skipped.agencies_no_email}</strong></span>
                )}
                {result.skipped.brokers_no_email > 0 && (
                  <span style={{ color: "var(--text-muted)" }}>{t.dashboard.adminUsersBrokersNoEmail}<strong>{result.skipped.brokers_no_email}</strong></span>
                )}
                {result.errors.length > 0 && (
                  <div style={{ marginTop: 8, color: "var(--error, #ef4444)" }}>
                    <strong>{t.dashboard.adminUsersErrors}</strong>
                    <ul style={{ margin: "4px 0 0 16px", fontSize: "0.8rem" }}>
                      {result.errors.slice(0, 10).map((e, i) => (
                        <li key={i}>{e}</li>
                      ))}
                      {result.errors.length > 10 && (
                        <li>{t.dashboard.adminUsersAndMore}{result.errors.length - 10}</li>
                      )}
                    </ul>
                  </div>
                )}
                {result.created.agencies === 0 && result.created.brokers === 0 && result.errors.length === 0 && (
                  <span>{t.dashboard.adminUsersAllExist}</span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
