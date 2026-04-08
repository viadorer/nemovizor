"use client";

import { useCallback, useEffect, useState } from "react";

const ALL_SCOPES = [
  { value: "read:public", label: "read:public", note: "Veřejné read endpointy (default, vždy aktivní)" },
  { value: "read:broker", label: "read:broker", note: "Read broker-scoped data (vlastní inzeráty, vlastní leady)" },
  { value: "write:broker", label: "write:broker", note: "Mutate broker-scoped data (vytvořit/upravit inzerát přes API)" },
  { value: "read:admin", label: "read:admin", note: "Cross-broker analytika (admin tier)" },
  { value: "write:webhooks", label: "write:webhooks", note: "Spravovat webhook subscriptions (Phase D)" },
] as const;

type ApiKeyRow = {
  id: string;
  name: string;
  key_prefix: string;
  owner_type: "broker" | "agency";
  owner_id: string;
  scopes: string[];
  rate_limit_per_min: number;
  created_at: string;
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
};

type CreateResponse = {
  data: ApiKeyRow;
  rawKey: string;
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString("cs-CZ", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function statusOf(row: ApiKeyRow): { label: string; color: string } {
  if (row.revoked_at) return { label: "Revokován", color: "#b91c1c" };
  if (row.expires_at && new Date(row.expires_at) <= new Date())
    return { label: "Expiroval", color: "#b91c1c" };
  return { label: "Aktivní", color: "#15803d" };
}

export default function AdminApiKeysPage() {
  const [rows, setRows] = useState<ApiKeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create form
  const [formOpen, setFormOpen] = useState(false);
  const [formName, setFormName] = useState("");
  const [formOwnerType, setFormOwnerType] = useState<"broker" | "agency">("broker");
  const [formOwnerId, setFormOwnerId] = useState("");
  const [formRateLimit, setFormRateLimit] = useState("300");
  const [formExpiresAt, setFormExpiresAt] = useState("");
  const [formScopes, setFormScopes] = useState<string[]>(["read:public"]);
  const [submitting, setSubmitting] = useState(false);

  // Just-created raw key (shown once)
  const [createdRaw, setCreatedRaw] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/api-keys", { cache: "no-store" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message || `HTTP ${res.status}`);
      }
      const body = (await res.json()) as { data: ApiKeyRow[] };
      setRows(body.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/api-keys", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: formName.trim(),
          owner_type: formOwnerType,
          owner_id: formOwnerId.trim(),
          rate_limit_per_min: parseInt(formRateLimit, 10) || 300,
          expires_at: formExpiresAt ? new Date(formExpiresAt).toISOString() : null,
          scopes: formScopes,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message || `HTTP ${res.status}`);
      }
      const body = (await res.json()) as CreateResponse;
      setCreatedRaw(body.rawKey);
      setFormOpen(false);
      setFormName("");
      setFormOwnerId("");
      setFormRateLimit("300");
      setFormExpiresAt("");
      setFormScopes(["read:public"]);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm("Opravdu revokovat tento klíč? Akce je nevratná.")) return;
    setError(null);
    try {
      const res = await fetch(`/api/admin/api-keys?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message || `HTTP ${res.status}`);
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to revoke");
    }
  };

  return (
    <div style={{ padding: "1.5rem", maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem", gap: 16 }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 4 }}>API klíče</h1>
          <p style={{ color: "var(--text-muted, #6b7280)", fontSize: "0.875rem" }}>
            Klíče pro programatický přístup k veřejnému Nemovizor API. Každý klíč patří jednomu brokerovi nebo jedné agentuře a může mít vlastní rate limit. Raw hodnota klíče je zobrazena pouze jednou při vytvoření.
          </p>
        </div>
        <button
          onClick={() => setFormOpen(true)}
          style={{
            padding: "0.6rem 1rem",
            background: "#111827",
            color: "white",
            border: "none",
            borderRadius: 6,
            fontWeight: 600,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          + Nový klíč
        </button>
      </div>

      {error && (
        <div
          style={{
            padding: "0.75rem 1rem",
            background: "#fef2f2",
            color: "#991b1b",
            border: "1px solid #fecaca",
            borderRadius: 6,
            marginBottom: "1rem",
          }}
        >
          {error}
        </div>
      )}

      {createdRaw && (
        <div
          style={{
            padding: "1rem",
            background: "#ecfdf5",
            color: "#065f46",
            border: "1px solid #a7f3d0",
            borderRadius: 6,
            marginBottom: "1rem",
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 8 }}>✅ Klíč vytvořen</div>
          <div style={{ fontSize: "0.875rem", marginBottom: 8 }}>
            Níže je raw hodnota klíče. <strong>Uložte si ji hned teď</strong> — po zavření této zprávy už ji nebude možné znovu zobrazit.
          </div>
          <code
            style={{
              display: "block",
              padding: "0.75rem",
              background: "white",
              border: "1px solid #a7f3d0",
              borderRadius: 4,
              fontFamily: "monospace",
              fontSize: "0.875rem",
              wordBreak: "break-all",
              userSelect: "all",
            }}
          >
            {createdRaw}
          </code>
          <button
            onClick={() => setCreatedRaw(null)}
            style={{
              marginTop: 8,
              padding: "0.4rem 0.8rem",
              background: "transparent",
              color: "#065f46",
              border: "1px solid #a7f3d0",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: "0.875rem",
            }}
          >
            Rozumím, zavřít
          </button>
        </div>
      )}

      {formOpen && (
        <form
          onSubmit={handleCreate}
          style={{
            padding: "1rem",
            border: "1px solid var(--border, #e5e7eb)",
            borderRadius: 8,
            background: "var(--bg-card, white)",
            marginBottom: "1rem",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "0.75rem",
          }}
        >
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: "0.75rem", fontWeight: 600 }}>Název (popisek)</span>
            <input
              required
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="např. Produkční klíč pro RK XY"
              style={{ padding: "0.5rem", borderRadius: 4, border: "1px solid var(--border, #e5e7eb)" }}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: "0.75rem", fontWeight: 600 }}>Typ vlastníka</span>
            <select
              value={formOwnerType}
              onChange={(e) => setFormOwnerType(e.target.value as "broker" | "agency")}
              style={{ padding: "0.5rem", borderRadius: 4, border: "1px solid var(--border, #e5e7eb)" }}
            >
              <option value="broker">Makléř (broker)</option>
              <option value="agency">Agentura (agency)</option>
            </select>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: "0.75rem", fontWeight: 600 }}>UUID vlastníka</span>
            <input
              required
              value={formOwnerId}
              onChange={(e) => setFormOwnerId(e.target.value)}
              placeholder="00000000-0000-0000-0000-000000000000"
              style={{ padding: "0.5rem", borderRadius: 4, border: "1px solid var(--border, #e5e7eb)", fontFamily: "monospace" }}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: "0.75rem", fontWeight: 600 }}>Rate limit (req/min)</span>
            <input
              type="number"
              min={1}
              value={formRateLimit}
              onChange={(e) => setFormRateLimit(e.target.value)}
              style={{ padding: "0.5rem", borderRadius: 4, border: "1px solid var(--border, #e5e7eb)" }}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, gridColumn: "1 / -1" }}>
            <span style={{ fontSize: "0.75rem", fontWeight: 600 }}>Scopes (oprávnění)</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {ALL_SCOPES.map((s) => {
                const checked = formScopes.includes(s.value);
                const isPublic = s.value === "read:public";
                return (
                  <label
                    key={s.value}
                    title={s.note}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "0.4rem 0.6rem",
                      border: `1px solid ${checked ? "#111827" : "var(--border, #e5e7eb)"}`,
                      borderRadius: 6,
                      background: checked ? "#11182710" : "transparent",
                      cursor: isPublic ? "not-allowed" : "pointer",
                      fontSize: "0.75rem",
                      fontFamily: "monospace",
                      opacity: isPublic ? 0.7 : 1,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={isPublic}
                      onChange={(e) => {
                        if (e.target.checked) setFormScopes((prev) => [...prev, s.value]);
                        else setFormScopes((prev) => prev.filter((x) => x !== s.value));
                      }}
                    />
                    {s.label}
                  </label>
                );
              })}
            </div>
            <span style={{ fontSize: "0.7rem", color: "var(--text-muted, #6b7280)" }}>
              `read:public` je vždy aktivní. Ostatní scopes opt-in.
            </span>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: "0.75rem", fontWeight: 600 }}>Expirace (volitelné)</span>
            <input
              type="date"
              value={formExpiresAt}
              onChange={(e) => setFormExpiresAt(e.target.value)}
              style={{ padding: "0.5rem", borderRadius: 4, border: "1px solid var(--border, #e5e7eb)" }}
            />
          </label>
          <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              style={{ padding: "0.6rem 1rem", background: "transparent", border: "1px solid var(--border, #e5e7eb)", borderRadius: 6, cursor: "pointer" }}
            >
              Zrušit
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={{ padding: "0.6rem 1rem", background: "#111827", color: "white", border: "none", borderRadius: 6, fontWeight: 600, cursor: submitting ? "wait" : "pointer" }}
            >
              {submitting ? "Vytvářím…" : "Vytvořit klíč"}
            </button>
          </div>
        </form>
      )}

      <div style={{ border: "1px solid var(--border, #e5e7eb)", borderRadius: 8, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
          <thead style={{ background: "var(--bg-muted, #f9fafb)" }}>
            <tr>
              <th style={thStyle}>Název</th>
              <th style={thStyle}>Prefix</th>
              <th style={thStyle}>Vlastník</th>
              <th style={thStyle}>Scopes</th>
              <th style={thStyle}>Limit/min</th>
              <th style={thStyle}>Vytvořen</th>
              <th style={thStyle}>Naposledy použit</th>
              <th style={thStyle}>Stav</th>
              <th style={thStyle}></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={9} style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted, #6b7280)" }}>
                  Načítání…
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={9} style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted, #6b7280)" }}>
                  Zatím žádné klíče. Vytvořte první pomocí tlačítka „Nový klíč".
                </td>
              </tr>
            )}
            {!loading &&
              rows.map((row) => {
                const st = statusOf(row);
                return (
                  <tr key={row.id} style={{ borderTop: "1px solid var(--border, #e5e7eb)" }}>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 600 }}>{row.name}</div>
                    </td>
                    <td style={{ ...tdStyle, fontFamily: "monospace" }}>{row.key_prefix}…</td>
                    <td style={tdStyle}>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted, #6b7280)" }}>
                        {row.owner_type}
                      </div>
                      <div style={{ fontFamily: "monospace", fontSize: "0.75rem" }}>
                        {row.owner_id.slice(0, 8)}…{row.owner_id.slice(-4)}
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, maxWidth: 200 }}>
                        {(row.scopes || ["read:public"]).map((s) => (
                          <span
                            key={s}
                            style={{
                              padding: "0.15rem 0.4rem",
                              background: "var(--bg-muted, #f3f4f6)",
                              borderRadius: 4,
                              fontSize: "0.65rem",
                              fontFamily: "monospace",
                            }}
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td style={tdStyle}>{row.rate_limit_per_min}</td>
                    <td style={tdStyle}>{fmtDate(row.created_at)}</td>
                    <td style={tdStyle}>{fmtDate(row.last_used_at)}</td>
                    <td style={tdStyle}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "0.2rem 0.5rem",
                          borderRadius: 999,
                          background: `${st.color}15`,
                          color: st.color,
                          fontSize: "0.75rem",
                          fontWeight: 600,
                        }}
                      >
                        {st.label}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      {!row.revoked_at && (
                        <button
                          onClick={() => handleRevoke(row.id)}
                          style={{
                            padding: "0.3rem 0.6rem",
                            background: "transparent",
                            color: "#b91c1c",
                            border: "1px solid #fecaca",
                            borderRadius: 4,
                            fontSize: "0.75rem",
                            cursor: "pointer",
                          }}
                        >
                          Revokovat
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "0.75rem",
  fontSize: "0.75rem",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.03em",
  color: "var(--text-muted, #6b7280)",
};

const tdStyle: React.CSSProperties = {
  padding: "0.75rem",
  verticalAlign: "middle",
};
