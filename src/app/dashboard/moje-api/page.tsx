"use client";

import { useCallback, useEffect, useState } from "react";

// ─── Types ─────────────────────────────────────────────────────────────────

type KeyRow = {
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

type WebhookRow = {
  id: string;
  url: string;
  secret_prefix: string;
  event_types: string[];
  filter: Record<string, unknown> | null;
  active: boolean;
  failure_count: number;
  disabled_at: string | null;
  last_delivered_at: string | null;
  created_at: string;
};

type AuditRow = {
  id: string;
  api_key_id: string;
  endpoint: string;
  method: string;
  status: number;
  latency_ms: number;
  created_at: string;
};

type AuditResp = {
  data: AuditRow[];
  total: number;
  aggregate: {
    window_total: number;
    success: number;
    client_error: number;
    server_error: number;
    rate_limited: number;
    avg_latency_ms: number;
  };
};

// ─── Helpers ───────────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("cs-CZ", {
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

function statusColor(s: number): string {
  if (s >= 200 && s < 300) return "#15803d";
  if (s === 429) return "#b45309";
  if (s >= 400 && s < 500) return "#9333ea";
  if (s >= 500) return "#b91c1c";
  return "var(--text-muted)";
}

const ALL_SCOPES = [
  { value: "read:public", label: "read:public", disabled: true },
  { value: "read:broker", label: "read:broker", disabled: false },
  { value: "write:broker", label: "write:broker", disabled: false },
  { value: "write:webhooks", label: "write:webhooks", disabled: false },
];

// ─── Page ──────────────────────────────────────────────────────────────────

type Tab = "keys" | "webhooks" | "audit";

export default function MyApiPage() {
  const [tab, setTab] = useState<Tab>("keys");

  return (
    <div style={{ padding: "1.5rem", maxWidth: 1400, margin: "0 auto" }}>
      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 4 }}>Moje API</h1>
        <p style={{ color: "var(--text-muted, #6b7280)", fontSize: "0.875rem" }}>
          Vaše API klíče, webhook subscriptions a audit log volání. Vše je scoped jen na vaše vlastní resources.
        </p>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: 4,
          marginBottom: "1.5rem",
          borderBottom: "1px solid var(--border, #e5e7eb)",
        }}
      >
        {([
          { id: "keys", label: "API klíče" },
          { id: "webhooks", label: "Webhooks" },
          { id: "audit", label: "Audit log" },
        ] as Array<{ id: Tab; label: string }>).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: "0.75rem 1.25rem",
              background: "transparent",
              border: "none",
              borderBottom: tab === t.id ? "2px solid var(--accent, #ffb800)" : "2px solid transparent",
              color: tab === t.id ? "var(--text)" : "var(--text-muted, #6b7280)",
              fontWeight: 600,
              fontSize: "0.875rem",
              cursor: "pointer",
              fontFamily: "inherit",
              marginBottom: -1,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "keys" && <KeysTab />}
      {tab === "webhooks" && <WebhooksTab />}
      {tab === "audit" && <AuditTab />}
    </div>
  );
}

// ─── Keys tab ──────────────────────────────────────────────────────────────

type BrokerScopeResp = {
  data: {
    primary_owner_type: "broker" | "agency" | null;
    primary_owner_id: string | null;
  };
};

function KeysTab() {
  const [rows, setRows] = useState<KeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createdRaw, setCreatedRaw] = useState<string | null>(null);
  const [scopeOwner, setScopeOwner] = useState<{ type: "broker" | "agency"; id: string } | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [formName, setFormName] = useState("");
  const [formScopes, setFormScopes] = useState<string[]>(["read:public"]);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [keysRes, scopeRes] = await Promise.all([
        fetch("/api/broker/api-keys", { cache: "no-store" }),
        fetch("/api/broker/scope", { cache: "no-store" }),
      ]);
      if (!keysRes.ok) {
        const body = await keysRes.json().catch(() => ({}));
        throw new Error(body?.error?.message || `HTTP ${keysRes.status}`);
      }
      const body = (await keysRes.json()) as { data: KeyRow[] };
      setRows(body.data);
      if (scopeRes.ok) {
        const scopeBody = (await scopeRes.json()) as BrokerScopeResp;
        if (scopeBody.data.primary_owner_type && scopeBody.data.primary_owner_id) {
          setScopeOwner({
            type: scopeBody.data.primary_owner_type,
            id: scopeBody.data.primary_owner_id,
          });
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nelze načíst");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scopeOwner) {
      setError("Nelze určit vaše scope — nemáte přiřazený broker ani agenturu.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/broker/api-keys", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: formName.trim(),
          owner_type: scopeOwner.type,
          owner_id: scopeOwner.id,
          scopes: formScopes,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message || `HTTP ${res.status}`);
      }
      const body = (await res.json()) as { data: KeyRow; rawKey: string };
      setCreatedRaw(body.rawKey);
      setFormOpen(false);
      setFormName("");
      setFormScopes(["read:public"]);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nelze vytvořit");
    } finally {
      setSubmitting(false);
    }
  };

  const onRevoke = async (id: string) => {
    if (!confirm("Opravdu revokovat tento klíč? Akce je nevratná.")) return;
    try {
      const res = await fetch(`/api/broker/api-keys?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message || `HTTP ${res.status}`);
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nelze revokovat");
    }
  };

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <p style={{ fontSize: "0.85rem", color: "var(--text-muted, #6b7280)", margin: 0 }}>
          API klíč umožňuje volat Nemovizor API s vyšším rate limitem a přístupem k privátním endpointům.
        </p>
        <button
          onClick={() => setFormOpen(true)}
          style={primaryButton}
        >
          Nový klíč
        </button>
      </div>

      {error && <Alert kind="error">{error}</Alert>}

      {createdRaw && (
        <div
          style={{
            padding: "1rem",
            background: "var(--bg-card, white)",
            border: "1px solid var(--accent, #ffb800)",
            borderRadius: 6,
            marginBottom: "1rem",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 8, color: "var(--text)" }}>
            API klíč vytvořen
          </div>
          <div style={{ fontSize: "0.85rem", marginBottom: 8, color: "var(--text-muted)" }}>
            Uložte si ho <strong>hned</strong>, po zavření této zprávy už ho nebude možné znovu zobrazit.
          </div>
          <code
            style={{
              display: "block",
              padding: "0.75rem",
              background: "var(--bg-input, #2a2a36)",
              border: "1px solid var(--border, #e5e7eb)",
              borderRadius: 4,
              fontFamily: "monospace",
              fontSize: "0.85rem",
              wordBreak: "break-all",
              userSelect: "all",
              color: "var(--text)",
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
              color: "var(--text)",
              border: "1px solid var(--border)",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: "0.85rem",
            }}
          >
            Rozumím, zavřít
          </button>
        </div>
      )}

      {formOpen && (
        <form
          onSubmit={onCreate}
          style={{
            padding: "1rem",
            border: "1px solid var(--border, #e5e7eb)",
            borderRadius: 8,
            background: "var(--bg-card, white)",
            marginBottom: "1rem",
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: "0.75rem",
          }}
        >
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={labelStyle}>Název (popisek)</span>
            <input
              required
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="např. Můj CRM sync"
              style={inputStyle}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={labelStyle}>Scopes</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {ALL_SCOPES.map((s) => {
                const checked = formScopes.includes(s.value);
                return (
                  <label
                    key={s.value}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "0.4rem 0.7rem",
                      border: `1px solid ${checked ? "var(--accent)" : "var(--border)"}`,
                      borderRadius: 6,
                      background: checked ? "var(--bg-card-hover)" : "transparent",
                      cursor: s.disabled ? "not-allowed" : "pointer",
                      fontSize: "0.75rem",
                      fontFamily: "monospace",
                      opacity: s.disabled ? 0.7 : 1,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={s.disabled}
                      onChange={(e) => {
                        if (e.target.checked) setFormScopes((p) => [...p, s.value]);
                        else setFormScopes((p) => p.filter((x) => x !== s.value));
                      }}
                    />
                    {s.label}
                  </label>
                );
              })}
            </div>
          </label>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              style={secondaryButton}
            >
              Zrušit
            </button>
            <button type="submit" disabled={submitting} style={primaryButton}>
              {submitting ? "Vytvářím…" : "Vytvořit klíč"}
            </button>
          </div>
        </form>
      )}

      <div style={tableContainer}>
        <table style={tableStyle}>
          <thead style={{ background: "var(--bg-secondary, #f9fafb)" }}>
            <tr>
              <th style={th}>Název</th>
              <th style={th}>Prefix</th>
              <th style={th}>Scopes</th>
              <th style={th}>Limit/min</th>
              <th style={th}>Vytvořen</th>
              <th style={th}>Naposledy použit</th>
              <th style={th}>Stav</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={8} style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
                  Načítání…
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={8} style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
                  Zatím žádné klíče. Vytvořte první pomocí tlačítka „Nový klíč".
                </td>
              </tr>
            )}
            {!loading &&
              rows.map((r) => {
                const st = r.revoked_at
                  ? { label: "Revokován", color: "#b91c1c" }
                  : r.expires_at && new Date(r.expires_at) <= new Date()
                    ? { label: "Expiroval", color: "#b91c1c" }
                    : { label: "Aktivní", color: "#15803d" };
                return (
                  <tr key={r.id} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={td}>
                      <div style={{ fontWeight: 600 }}>{r.name}</div>
                    </td>
                    <td style={{ ...td, fontFamily: "monospace" }}>{r.key_prefix}…</td>
                    <td style={td}>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                        {(r.scopes || []).map((s) => (
                          <span
                            key={s}
                            style={{
                              padding: "0.15rem 0.4rem",
                              background: "var(--bg-secondary)",
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
                    <td style={td}>{r.rate_limit_per_min}</td>
                    <td style={td}>{fmtDate(r.created_at)}</td>
                    <td style={td}>{fmtDate(r.last_used_at)}</td>
                    <td style={{ ...td, color: st.color, fontWeight: 600 }}>{st.label}</td>
                    <td style={td}>
                      {!r.revoked_at && (
                        <button
                          onClick={() => onRevoke(r.id)}
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
    </>
  );
}

// ─── Webhooks tab ──────────────────────────────────────────────────────────

function WebhooksTab() {
  const [rows, setRows] = useState<WebhookRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [formUrl, setFormUrl] = useState("");
  const [formCountry, setFormCountry] = useState("");
  const [formCategory, setFormCategory] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/broker/webhooks", { cache: "no-store" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message || `HTTP ${res.status}`);
      }
      const body = (await res.json()) as { data: WebhookRow[] };
      setRows(body.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nelze načíst");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const filter: Record<string, unknown> = {};
      if (formCountry.trim()) filter.country = [formCountry.trim()];
      if (formCategory.length > 0) filter.category = formCategory;
      const res = await fetch("/api/broker/webhooks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          url: formUrl.trim(),
          filter: Object.keys(filter).length > 0 ? filter : null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message || `HTTP ${res.status}`);
      }
      const body = (await res.json()) as { data: WebhookRow; secret: string };
      setCreatedSecret(body.secret);
      setFormOpen(false);
      setFormUrl("");
      setFormCountry("");
      setFormCategory([]);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nelze vytvořit");
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = async (id: string) => {
    if (!confirm("Opravdu smazat webhook? Další události už nedostanete.")) return;
    try {
      const res = await fetch(`/api/broker/webhooks?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message || `HTTP ${res.status}`);
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nelze smazat");
    }
  };

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", margin: 0 }}>
          Webhook doručí HTTPS POST s HMAC-SHA256 podpisem kdykoli dojde k property.created / updated / deleted / price_changed.
        </p>
        <button onClick={() => setFormOpen(true)} style={primaryButton}>
          Nový webhook
        </button>
      </div>

      {error && <Alert kind="error">{error}</Alert>}

      {createdSecret && (
        <div
          style={{
            padding: "1rem",
            background: "var(--bg-card)",
            border: "1px solid var(--accent)",
            borderRadius: 6,
            marginBottom: "1rem",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 8, color: "var(--text)" }}>
            Webhook vytvořen — ulož podpisový secret
          </div>
          <div style={{ fontSize: "0.85rem", marginBottom: 8, color: "var(--text-muted)" }}>
            Tímto secretem ověříš signaturu v hlavičce <code>X-Nemovizor-Signature: sha256=...</code> u každého doručeného webhooku.
          </div>
          <code
            style={{
              display: "block",
              padding: "0.75rem",
              background: "var(--bg-input)",
              border: "1px solid var(--border)",
              borderRadius: 4,
              fontFamily: "monospace",
              fontSize: "0.85rem",
              wordBreak: "break-all",
              userSelect: "all",
              color: "var(--text)",
            }}
          >
            {createdSecret}
          </code>
          <button
            onClick={() => setCreatedSecret(null)}
            style={{
              marginTop: 8,
              padding: "0.4rem 0.8rem",
              background: "transparent",
              color: "var(--text)",
              border: "1px solid var(--border)",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: "0.85rem",
            }}
          >
            Rozumím, zavřít
          </button>
        </div>
      )}

      {formOpen && (
        <form
          onSubmit={onCreate}
          style={{
            padding: "1rem",
            border: "1px solid var(--border)",
            borderRadius: 8,
            background: "var(--bg-card)",
            marginBottom: "1rem",
            display: "grid",
            gap: "0.75rem",
          }}
        >
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={labelStyle}>URL (musí být HTTPS)</span>
            <input
              required
              type="url"
              value={formUrl}
              onChange={(e) => setFormUrl(e.target.value)}
              placeholder="https://example.com/webhooks/nemovizor"
              style={inputStyle}
            />
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={labelStyle}>Země (2-písm. kód, volitelné)</span>
              <input
                value={formCountry}
                onChange={(e) => setFormCountry(e.target.value)}
                placeholder="cz"
                style={inputStyle}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={labelStyle}>Kategorie (volitelné)</span>
              <select
                multiple
                value={formCategory}
                onChange={(e) =>
                  setFormCategory(Array.from(e.target.selectedOptions).map((o) => o.value))
                }
                style={{ ...inputStyle, height: 80 }}
              >
                <option value="apartment">apartment</option>
                <option value="house">house</option>
                <option value="land">land</option>
                <option value="commercial">commercial</option>
              </select>
            </label>
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button type="button" onClick={() => setFormOpen(false)} style={secondaryButton}>
              Zrušit
            </button>
            <button type="submit" disabled={submitting} style={primaryButton}>
              {submitting ? "Vytvářím…" : "Vytvořit webhook"}
            </button>
          </div>
        </form>
      )}

      <div style={tableContainer}>
        <table style={tableStyle}>
          <thead style={{ background: "var(--bg-secondary)" }}>
            <tr>
              <th style={th}>URL</th>
              <th style={th}>Events</th>
              <th style={th}>Filter</th>
              <th style={th}>Stav</th>
              <th style={th}>Last delivery</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
                  Načítání…
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
                  Zatím žádné webhooks.
                </td>
              </tr>
            )}
            {!loading &&
              rows.map((r) => {
                const st = r.disabled_at
                  ? { label: "Auto-disabled", color: "#b91c1c" }
                  : !r.active
                    ? { label: "Pozastaveno", color: "#9333ea" }
                    : r.failure_count > 0
                      ? { label: `${r.failure_count} fails`, color: "#b45309" }
                      : { label: "Aktivní", color: "#15803d" };
                return (
                  <tr key={r.id} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ ...td, fontFamily: "monospace", maxWidth: 320, wordBreak: "break-all" }}>
                      {r.url}
                    </td>
                    <td style={td}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        {r.event_types.map((e) => (
                          <span key={e} style={{ fontFamily: "monospace", fontSize: "0.65rem" }}>
                            {e}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td style={{ ...td, maxWidth: 180, fontFamily: "monospace", fontSize: "0.65rem" }}>
                      {r.filter ? JSON.stringify(r.filter) : "—"}
                    </td>
                    <td style={{ ...td, color: st.color, fontWeight: 600 }}>{st.label}</td>
                    <td style={td}>{fmtDate(r.last_delivered_at)}</td>
                    <td style={td}>
                      <button
                        onClick={() => onDelete(r.id)}
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
                        Smazat
                      </button>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ─── Audit tab ─────────────────────────────────────────────────────────────

function AuditTab() {
  const [data, setData] = useState<AuditResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [window, setWindow] = useState("24");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const since = new Date(Date.now() - parseInt(window, 10) * 3_600_000).toISOString();
      const res = await fetch(
        `/api/broker/api-audit?since=${encodeURIComponent(since)}&limit=200`,
        { cache: "no-store" },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message || `HTTP ${res.status}`);
      }
      setData((await res.json()) as AuditResp);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nelze načíst");
    } finally {
      setLoading(false);
    }
  }, [window]);

  useEffect(() => {
    load();
  }, [load]);

  const agg = data?.aggregate;

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", margin: 0 }}>
          Per-request log volání vašich API klíčů. Anonymous requesty zde nevidíte.
        </p>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select
            value={window}
            onChange={(e) => setWindow(e.target.value)}
            style={{ ...inputStyle, padding: "0.4rem", fontSize: "0.8rem" }}
          >
            <option value="1">Last 1h</option>
            <option value="6">Last 6h</option>
            <option value="24">Last 24h</option>
            <option value="168">Last 7d</option>
            <option value="720">Last 30d</option>
          </select>
          <button onClick={load} style={secondaryButton}>
            Refresh
          </button>
        </div>
      </div>

      {error && <Alert kind="error">{error}</Alert>}

      {agg && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: "0.75rem",
            marginBottom: "1.5rem",
          }}
        >
          <Kpi label="Total" value={agg.window_total} />
          <Kpi label="2xx" value={agg.success} color="#15803d" />
          <Kpi label="4xx" value={agg.client_error} color="#9333ea" />
          <Kpi label="5xx" value={agg.server_error} color="#b91c1c" />
          <Kpi label="429" value={agg.rate_limited} color="#b45309" />
          <Kpi label="Avg latency" value={`${agg.avg_latency_ms} ms`} />
        </div>
      )}

      <div style={tableContainer}>
        <table style={tableStyle}>
          <thead style={{ background: "var(--bg-secondary)" }}>
            <tr>
              <th style={th}>Time</th>
              <th style={th}>Method</th>
              <th style={th}>Endpoint</th>
              <th style={th}>Status</th>
              <th style={th}>Latency</th>
              <th style={th}>Key</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
                  Načítání…
                </td>
              </tr>
            )}
            {!loading && (data?.data || []).length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
                  Žádné requesty v tomto okně.
                </td>
              </tr>
            )}
            {!loading &&
              data?.data.map((row) => (
                <tr key={row.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={td}>{fmtDate(row.created_at)}</td>
                  <td style={{ ...td, fontFamily: "monospace" }}>{row.method}</td>
                  <td style={{ ...td, fontFamily: "monospace" }}>{row.endpoint}</td>
                  <td style={{ ...td, fontWeight: 600, color: statusColor(row.status) }}>{row.status}</td>
                  <td style={td}>{row.latency_ms} ms</td>
                  <td style={{ ...td, fontFamily: "monospace", fontSize: "0.7rem" }}>
                    {row.api_key_id?.slice(0, 8)}…
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ─── Shared UI primitives ──────────────────────────────────────────────────

function Alert({ kind, children }: { kind: "error"; children: React.ReactNode }) {
  void kind;
  return (
    <div
      style={{
        padding: "0.75rem 1rem",
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderLeft: "3px solid #b91c1c",
        borderRadius: 6,
        marginBottom: "1rem",
        color: "#fca5a5",
        fontSize: "0.85rem",
      }}
    >
      {children}
    </div>
  );
}

function Kpi({ label, value, color }: { label: string; value: number | string; color?: string }) {
  return (
    <div
      style={{
        padding: "0.75rem 1rem",
        border: "1px solid var(--border)",
        borderRadius: 8,
        background: "var(--bg-card)",
      }}
    >
      <div
        style={{
          fontSize: "0.7rem",
          color: "var(--text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.03em",
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: "1.5rem", fontWeight: 700, color: color || undefined }}>
        {typeof value === "number" ? value.toLocaleString("cs-CZ") : value}
      </div>
    </div>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────

const primaryButton: React.CSSProperties = {
  padding: "0.6rem 1rem",
  background: "var(--accent, #ffb800)",
  color: "var(--accent-text, #1a1a2e)",
  border: "1px solid var(--accent, #ffb800)",
  borderRadius: 6,
  fontWeight: 700,
  cursor: "pointer",
  fontSize: "0.8rem",
  fontFamily: "inherit",
};

const secondaryButton: React.CSSProperties = {
  padding: "0.6rem 1rem",
  background: "transparent",
  color: "var(--text)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  fontWeight: 600,
  cursor: "pointer",
  fontSize: "0.8rem",
  fontFamily: "inherit",
};

const labelStyle: React.CSSProperties = {
  fontSize: "0.7rem",
  fontWeight: 700,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const inputStyle: React.CSSProperties = {
  padding: "0.6rem",
  background: "var(--bg-input, #fff)",
  border: "1px solid var(--border, #e5e7eb)",
  borderRadius: 6,
  color: "var(--text)",
  fontSize: "0.85rem",
  fontFamily: "inherit",
};

const tableContainer: React.CSSProperties = {
  border: "1px solid var(--border, #e5e7eb)",
  borderRadius: 8,
  overflow: "auto",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: "0.8rem",
};

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "0.6rem",
  fontSize: "0.7rem",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.03em",
  color: "var(--text-muted, #6b7280)",
};

const td: React.CSSProperties = {
  padding: "0.6rem",
  verticalAlign: "middle",
};
