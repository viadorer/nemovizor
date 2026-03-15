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

type AccountPreview = {
  agencies: { total: number; with_account: number; need_account: number };
  brokers: { total: number; with_account: number; need_account: number };
};

type AccountResult = {
  created: { agencies: number; brokers: number };
  skipped: { agencies_no_email: number; agencies_has_account: number; brokers_no_email: number; brokers_has_account: number; duplicate_email: number };
  errors: string[];
};

const roleLabels: Record<string, string> = {
  user: "U\u017eivatel",
  broker: "Makl\u00e9\u0159",
  admin: "Admin",
};

const columns: Column<UserRow>[] = [
  {
    key: "full_name",
    label: "Jm\u00e9no",
    render: (row) => row.full_name || "Bez jm\u00e9na",
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
  { key: "preferred_city", label: "M\u011bsto", render: (row) => row.preferred_city || "-" },
  {
    key: "created_at",
    label: "Registrace",
    render: (row) => new Date(row.created_at).toLocaleDateString("cs"),
  },
];

export default function AdminUsersPage() {
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
        title="U\u017eivatel\u00e9"
        columns={columns}
        fetchData={fetchData}
        rowKey={(row) => row.id}
        searchPlaceholder={"Hledat podle jm\u00e9na..."}
        rowActions={(row) => (
          <select
            className="admin-btn admin-btn--secondary admin-btn--sm"
            style={{ padding: "4px 8px", fontSize: "0.8rem" }}
            value={row.role}
            onChange={(e) => handleRoleChange(row, e.target.value)}
          >
            <option value="user">{"\u00dA\u017eivatel"}</option>
            <option value="broker">{"Makl\u00e9\u0159"}</option>
            <option value="admin">Admin</option>
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
          {"Vytvo\u0159it \u00fa\u010dty pro kancel\u00e1\u0159e a makl\u00e9\u0159e"}
        </h3>
        <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: 16 }}>
          {"Automaticky vytvo\u0159\u00ed u\u017eivatelsk\u00e9 \u00fa\u010dty pro kancel\u00e1\u0159e a makl\u00e9\u0159e, kte\u0159\u00ed maj\u00ed e-mail ale je\u0161t\u011b nemaj\u00ed \u00fa\u010det. Kontroluje duplicitu e-mail\u016f."}
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
            {"Zobrazit p\u0159ehled"}
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
              {`Vytvo\u0159it ${preview.agencies.need_account + preview.brokers.need_account} \u00fa\u010dt\u016f`}
            </button>
          )}
        </div>

        {/* Preview stats */}
        {preview && (
          <div className="pf-account-preview" style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div className="admin-card" style={{ padding: 16 }}>
              <h4 style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: 8 }}>{"Kancel\u00e1\u0159e"}</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.85rem" }}>
                <span>{"Celkem: "}<strong>{preview.agencies.total}</strong></span>
                <span>{"S \u00fa\u010dtem: "}<strong>{preview.agencies.with_account}</strong></span>
                <span style={{ color: preview.agencies.need_account > 0 ? "var(--accent)" : "var(--text-muted)" }}>
                  {"K vytvo\u0159en\u00ed: "}<strong>{preview.agencies.need_account}</strong>
                </span>
              </div>
            </div>
            <div className="admin-card" style={{ padding: 16 }}>
              <h4 style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: 8 }}>{"Makl\u00e9\u0159i"}</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.85rem" }}>
                <span>{"Celkem: "}<strong>{preview.brokers.total}</strong></span>
                <span>{"S \u00fa\u010dtem: "}<strong>{preview.brokers.with_account}</strong></span>
                <span style={{ color: preview.brokers.need_account > 0 ? "var(--accent)" : "var(--text-muted)" }}>
                  {"K vytvo\u0159en\u00ed: "}<strong>{preview.brokers.need_account}</strong>
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Result */}
        {result && (
          <div style={{ marginTop: 16 }}>
            <div className="admin-card" style={{ padding: 16, background: result.errors.length > 0 ? "var(--bg-error)" : "var(--bg-success, #f0fdf4)" }}>
              <h4 style={{ fontSize: "0.9rem", marginBottom: 8 }}>{"V\u00fdsledek"}</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.85rem" }}>
                {result.created.agencies > 0 && (
                  <span>{"Vytvo\u0159eno \u00fa\u010dt\u016f kancel\u00e1\u0159\u00ed: "}<strong>{result.created.agencies}</strong></span>
                )}
                {result.created.brokers > 0 && (
                  <span>{"Vytvo\u0159eno \u00fa\u010dt\u016f makl\u00e9\u0159\u016f: "}<strong>{result.created.brokers}</strong></span>
                )}
                {result.skipped.duplicate_email > 0 && (
                  <span style={{ color: "var(--text-muted)" }}>{"P\u0159eskoceno (duplicitn\u00ed email): "}<strong>{result.skipped.duplicate_email}</strong></span>
                )}
                {result.skipped.agencies_no_email > 0 && (
                  <span style={{ color: "var(--text-muted)" }}>{"Kancel\u00e1\u0159e bez emailu: "}<strong>{result.skipped.agencies_no_email}</strong></span>
                )}
                {result.skipped.brokers_no_email > 0 && (
                  <span style={{ color: "var(--text-muted)" }}>{"Makl\u00e9\u0159i bez emailu: "}<strong>{result.skipped.brokers_no_email}</strong></span>
                )}
                {result.errors.length > 0 && (
                  <div style={{ marginTop: 8, color: "var(--error, #ef4444)" }}>
                    <strong>Chyby:</strong>
                    <ul style={{ margin: "4px 0 0 16px", fontSize: "0.8rem" }}>
                      {result.errors.slice(0, 10).map((e, i) => (
                        <li key={i}>{e}</li>
                      ))}
                      {result.errors.length > 10 && (
                        <li>{"...a dal\u0161\u00edch "}{result.errors.length - 10}</li>
                      )}
                    </ul>
                  </div>
                )}
                {result.created.agencies === 0 && result.created.brokers === 0 && result.errors.length === 0 && (
                  <span>{"V\u0161echny \u00fa\u010dty ji\u017e existuj\u00ed."}</span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
